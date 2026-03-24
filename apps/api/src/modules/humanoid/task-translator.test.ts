import { describe, it, expect } from 'vitest';
import { SOPNodeType } from '@surrogate-os/shared';
import type { SOPNode } from '@surrogate-os/shared';
import { translateTask, type TranslationContext } from './task-translator.js';
import { ActionAuthLevel, InterfaceModality } from './interfaces.js';

// --- Test helpers ---

function makeNode(
  id: string,
  type: SOPNodeType,
  overrides?: Partial<SOPNode>,
): SOPNode {
  return {
    id,
    type,
    label: `Node ${id}`,
    description: `Description for ${id}`,
    config: {},
    ...overrides,
  };
}

const defaultContext: TranslationContext = {
  humanProximity: false,
  medicalContext: false,
  environmentType: 'INDOOR',
};

describe('translateTask()', () => {
  describe('node type -> action type mapping', () => {
    it('translates INFORMATION_GATHER node to INSPECT actions', () => {
      const node = makeNode('ig', SOPNodeType.INFORMATION_GATHER);
      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      expect(result.physicalActions.length).toBeGreaterThanOrEqual(1);
      expect(result.physicalActions[0].actionType).toBe('INSPECT');
    });

    it('translates DECISION node to WAIT and COMMUNICATE actions', () => {
      const node = makeNode('dec', SOPNodeType.DECISION);
      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      const actionTypes = result.physicalActions.map((a) => a.actionType);
      expect(actionTypes).toContain('WAIT');
      expect(actionTypes).toContain('COMMUNICATE');
    });

    it('translates ACTION_PHYSICAL node to MOVE, GRASP, PLACE actions', () => {
      const node = makeNode('ap', SOPNodeType.ACTION_PHYSICAL);
      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      const actionTypes = result.physicalActions.map((a) => a.actionType);
      expect(actionTypes).toContain('MOVE');
      expect(actionTypes).toContain('GRASP');
      expect(actionTypes).toContain('PLACE');
    });

    it('translates CHECKPOINT node to WAIT and COMMUNICATE', () => {
      const node = makeNode('cp', SOPNodeType.CHECKPOINT);
      const result = translateTask(node, InterfaceModality.SEMI_AUTONOMOUS, defaultContext);

      const actionTypes = result.physicalActions.map((a) => a.actionType);
      expect(actionTypes).toContain('WAIT');
      expect(actionTypes).toContain('COMMUNICATE');
    });

    it('translates ESCALATION node to WAIT and COMMUNICATE', () => {
      const node = makeNode('esc', SOPNodeType.ESCALATION);
      const result = translateTask(node, InterfaceModality.SEMI_AUTONOMOUS, defaultContext);

      const actionTypes = result.physicalActions.map((a) => a.actionType);
      expect(actionTypes).toContain('WAIT');
      expect(actionTypes).toContain('COMMUNICATE');
    });

    it('translates ASSESSMENT node to INSPECT', () => {
      const node = makeNode('assess', SOPNodeType.ASSESSMENT);
      const result = translateTask(node, InterfaceModality.EXOSUIT, defaultContext);

      expect(result.physicalActions[0].actionType).toBe('INSPECT');
    });

    it('translates ACTION_DIGITAL node to COMMUNICATE', () => {
      const node = makeNode('dig', SOPNodeType.ACTION_DIGITAL);
      const result = translateTask(node, InterfaceModality.EXOSUIT, defaultContext);

      expect(result.physicalActions[0].actionType).toBe('COMMUNICATE');
    });

    it('translates DOCUMENTATION node to INSPECT', () => {
      const node = makeNode('doc', SOPNodeType.DOCUMENTATION);
      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      expect(result.physicalActions[0].actionType).toBe('INSPECT');
    });

    it('translates HANDOVER node to COMMUNICATE and WAIT', () => {
      const node = makeNode('ho', SOPNodeType.HANDOVER);
      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      const actionTypes = result.physicalActions.map((a) => a.actionType);
      expect(actionTypes).toContain('COMMUNICATE');
      expect(actionTypes).toContain('WAIT');
    });
  });

  describe('modality -> authorization level mapping', () => {
    it('FULLY_AUTONOMOUS modality gets L3_ACT_WITH_APPROVAL due to high modality risk weight', () => {
      // FULLY_AUTONOMOUS has risk weight 5, which gives HIGH risk (score >= 5)
      // HIGH risk always requires L3_ACT_WITH_APPROVAL
      const node = makeNode('assess', SOPNodeType.ASSESSMENT);
      const result = translateTask(node, InterfaceModality.FULLY_AUTONOMOUS, defaultContext);

      expect(result.requiredAuthLevel).toBe(ActionAuthLevel.L3_ACT_WITH_APPROVAL);
      expect(result.riskAssessment.overallRisk).toBe('HIGH');
    });

    it('SEMI_AUTONOMOUS modality gets L4_ACT_NOTIFY for medium risk without human proximity', () => {
      // SEMI_AUTONOMOUS has risk weight 4, which gives MEDIUM risk (score 3-4)
      // MEDIUM risk without human proximity => L4_ACT_NOTIFY
      const node = makeNode('doc', SOPNodeType.DOCUMENTATION);
      const result = translateTask(node, InterfaceModality.SEMI_AUTONOMOUS, defaultContext);

      expect(result.requiredAuthLevel).toBe(ActionAuthLevel.L4_ACT_NOTIFY);
      expect(result.riskAssessment.overallRisk).toBe('MEDIUM');
    });

    it('AR_OVERLAY modality with low-risk node gets L2_SUGGEST', () => {
      // AR_OVERLAY has risk weight 1, and DOCUMENTATION adds no extra risk
      // Total score = 1 => LOW risk. Non-autonomous modality => L2_SUGGEST
      const node = makeNode('doc', SOPNodeType.DOCUMENTATION);
      const result = translateTask(node, InterfaceModality.AR_OVERLAY, defaultContext);

      expect(result.requiredAuthLevel).toBe(ActionAuthLevel.L2_SUGGEST);
      expect(result.riskAssessment.overallRisk).toBe('LOW');
    });

    it('CHAT modality gets L1_OBSERVE', () => {
      const node = makeNode('dec', SOPNodeType.DECISION);
      const result = translateTask(node, InterfaceModality.CHAT, defaultContext);

      expect(result.requiredAuthLevel).toBe(ActionAuthLevel.L1_OBSERVE);
    });

    it('VOICE modality gets L1_OBSERVE', () => {
      const node = makeNode('ig', SOPNodeType.INFORMATION_GATHER);
      const result = translateTask(node, InterfaceModality.VOICE, defaultContext);

      expect(result.requiredAuthLevel).toBe(ActionAuthLevel.L1_OBSERVE);
    });

    it('AVATAR modality gets L1_OBSERVE', () => {
      const node = makeNode('action', SOPNodeType.ACTION_DIGITAL);
      const result = translateTask(node, InterfaceModality.AVATAR, defaultContext);

      expect(result.requiredAuthLevel).toBe(ActionAuthLevel.L1_OBSERVE);
    });
  });

  describe('context-based risk assessment', () => {
    it('medical context increases risk assessment', () => {
      const node = makeNode('action', SOPNodeType.ACTION_DIGITAL);
      const medicalCtx: TranslationContext = {
        humanProximity: false,
        medicalContext: true,
        environmentType: 'INDOOR',
      };

      const withMedical = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, medicalCtx);
      const withoutMedical = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      // Medical context should require higher auth level (approval)
      expect(withMedical.requiredAuthLevel).toBe(ActionAuthLevel.L3_ACT_WITH_APPROVAL);
      expect(withMedical.riskAssessment.medicalContext).toBe(true);
      expect(withMedical.riskAssessment.factors.some((f) => f.includes('Medical'))).toBe(true);

      // Without medical, risk should be lower or equal
      expect(withoutMedical.riskAssessment.medicalContext).toBe(false);
    });

    it('human proximity increases risk level', () => {
      const node = makeNode('action', SOPNodeType.ACTION_DIGITAL);
      const proximityCtx: TranslationContext = {
        humanProximity: true,
        medicalContext: false,
        environmentType: 'INDOOR',
      };

      const withProximity = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, proximityCtx);

      expect(withProximity.riskAssessment.humanProximity).toBe(true);
      expect(withProximity.riskAssessment.factors.some((f) => f.includes('proximity'))).toBe(true);
    });

    it('hazardous environment adds risk factors', () => {
      const node = makeNode('action', SOPNodeType.ACTION_DIGITAL);
      const hazardousCtx: TranslationContext = {
        humanProximity: false,
        medicalContext: false,
        environmentType: 'HAZARDOUS',
      };

      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, hazardousCtx);
      expect(result.riskAssessment.factors.some((f) => f.includes('Hazardous'))).toBe(true);
    });

    it('ACTION_PHYSICAL node has higher risk and is marked non-reversible', () => {
      const node = makeNode('phys', SOPNodeType.ACTION_PHYSICAL);
      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      expect(result.riskAssessment.reversible).toBe(false);
      expect(result.riskAssessment.factors.some((f) => f.includes('Physical action'))).toBe(true);
    });

    it('non-physical action node is marked as reversible', () => {
      const node = makeNode('digital', SOPNodeType.ACTION_DIGITAL);
      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      expect(result.riskAssessment.reversible).toBe(true);
    });
  });

  describe('output structure validation', () => {
    it('returns non-empty physical actions array', () => {
      const node = makeNode('test', SOPNodeType.INFORMATION_GATHER);
      const result = translateTask(node, InterfaceModality.EXOSUIT, defaultContext);

      expect(result.physicalActions.length).toBeGreaterThan(0);
    });

    it('each physical action has required fields', () => {
      const node = makeNode('test', SOPNodeType.ACTION_PHYSICAL);
      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      for (const action of result.physicalActions) {
        expect(action.id).toBeDefined();
        expect(typeof action.id).toBe('string');
        expect(action.sequence).toBeGreaterThanOrEqual(1);
        expect(typeof action.description).toBe('string');
        expect(action.description.length).toBeGreaterThan(0);
        expect(action.actionType).toBeDefined();
        expect(action.parameters).toBeDefined();
        expect(Array.isArray(action.safetyConstraints)).toBe(true);
        expect(action.safetyConstraints.length).toBeGreaterThan(0);
      }
    });

    it('actions are sequenced correctly (1, 2, 3...)', () => {
      const node = makeNode('phys', SOPNodeType.ACTION_PHYSICAL);
      const result = translateTask(node, InterfaceModality.FULLY_AUTONOMOUS, defaultContext);

      for (let i = 0; i < result.physicalActions.length; i++) {
        expect(result.physicalActions[i].sequence).toBe(i + 1);
      }
    });

    it('RiskAssessment has valid structure', () => {
      const node = makeNode('test', SOPNodeType.DECISION);
      const result = translateTask(node, InterfaceModality.SEMI_AUTONOMOUS, defaultContext);

      const risk = result.riskAssessment;
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(risk.overallRisk);
      expect(typeof risk.humanProximity).toBe('boolean');
      expect(typeof risk.reversible).toBe('boolean');
      expect(typeof risk.medicalContext).toBe('boolean');
      expect(Array.isArray(risk.factors)).toBe(true);
    });

    it('estimated duration is a positive number', () => {
      const node = makeNode('test', SOPNodeType.ACTION_PHYSICAL);
      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, defaultContext);

      expect(result.estimatedDuration).toBeGreaterThan(0);
      expect(Number.isFinite(result.estimatedDuration)).toBe(true);
    });

    it('cognitiveTask includes node type and label', () => {
      const node = makeNode('test', SOPNodeType.INFORMATION_GATHER, { label: 'Gather Data' });
      const result = translateTask(node, InterfaceModality.CHAT, defaultContext);

      expect(result.cognitiveTask).toContain('INFORMATION_GATHER');
      expect(result.cognitiveTask).toContain('Gather Data');
    });

    it('higher-risk modalities produce longer estimated durations', () => {
      const node = makeNode('test', SOPNodeType.ACTION_PHYSICAL);

      const chatResult = translateTask(node, InterfaceModality.CHAT, defaultContext);
      const robotResult = translateTask(node, InterfaceModality.FULLY_AUTONOMOUS, defaultContext);

      // FULLY_AUTONOMOUS has risk weight 5, CHAT has 0 => longer duration
      expect(robotResult.estimatedDuration).toBeGreaterThan(chatResult.estimatedDuration);
    });

    it('includes context-specific safety constraints', () => {
      const node = makeNode('test', SOPNodeType.INFORMATION_GATHER);
      const ctx: TranslationContext = {
        humanProximity: true,
        medicalContext: true,
        environmentType: 'CLEANROOM',
      };

      const result = translateTask(node, InterfaceModality.COLLABORATIVE_ROBOT, ctx);

      const allConstraints = result.physicalActions.flatMap((a) => a.safetyConstraints);
      expect(allConstraints.some((c) => c.includes('Human proximity'))).toBe(true);
      expect(allConstraints.some((c) => c.includes('Medical context'))).toBe(true);
      expect(allConstraints.some((c) => c.includes('Cleanroom'))).toBe(true);
    });
  });
});
