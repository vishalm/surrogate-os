import { randomUUID } from 'node:crypto';
import type { SOPNode } from '@surrogate-os/shared';
import { SOPNodeType } from '@surrogate-os/shared';
import {
  ActionAuthLevel,
  type InterfaceModality,
  type TaskTranslation,
  type PhysicalAction,
  type RiskAssessment,
  type PhysicalActionType,
  type RiskSeverity,
} from './interfaces.js';

// --- Translation context provided at call-site ---

export interface TranslationContext {
  humanProximity: boolean;
  medicalContext: boolean;
  environmentType: 'INDOOR' | 'OUTDOOR' | 'HAZARDOUS' | 'CLEANROOM';
}

// --- Modality-based risk multipliers ---

const MODALITY_RISK_WEIGHT: Record<string, number> = {
  CHAT: 0,
  VOICE: 0,
  AVATAR: 0,
  AR_OVERLAY: 1,
  EXOSUIT: 2,
  COLLABORATIVE_ROBOT: 3,
  SEMI_AUTONOMOUS: 4,
  FULLY_AUTONOMOUS: 5,
};

// --- Node type -> default physical action patterns ---

interface ActionPattern {
  actionType: PhysicalActionType;
  description: string;
  safetyConstraints: string[];
  rollbackAction?: string;
}

const NODE_ACTION_PATTERNS: Record<string, ActionPattern[]> = {
  [SOPNodeType.INFORMATION_GATHER]: [
    {
      actionType: 'INSPECT',
      description: 'Observe and collect information from environment',
      safetyConstraints: ['Maintain safe observation distance', 'Do not disturb environment'],
    },
  ],
  [SOPNodeType.ASSESSMENT]: [
    {
      actionType: 'INSPECT',
      description: 'Evaluate current state against criteria',
      safetyConstraints: ['Verify sensor readings before assessment'],
    },
  ],
  [SOPNodeType.DECISION]: [
    {
      actionType: 'WAIT',
      description: 'Pause for decision evaluation',
      safetyConstraints: ['Maintain safe idle posture', 'Monitor surroundings during pause'],
    },
    {
      actionType: 'COMMUNICATE',
      description: 'Announce decision outcome',
      safetyConstraints: ['Ensure all stakeholders are notified'],
    },
  ],
  [SOPNodeType.ACTION_DIGITAL]: [
    {
      actionType: 'COMMUNICATE',
      description: 'Execute digital action via interface',
      safetyConstraints: ['Verify digital action parameters', 'Confirm network connectivity'],
    },
  ],
  [SOPNodeType.ACTION_PHYSICAL]: [
    {
      actionType: 'MOVE',
      description: 'Navigate to action location',
      safetyConstraints: ['Check path clearance', 'Maintain collision avoidance'],
      rollbackAction: 'Return to previous position',
    },
    {
      actionType: 'GRASP',
      description: 'Engage with physical target',
      safetyConstraints: ['Verify grip force limits', 'Check object stability'],
      rollbackAction: 'Release and retract',
    },
    {
      actionType: 'PLACE',
      description: 'Position object at target location',
      safetyConstraints: ['Verify placement surface stability', 'Confirm alignment'],
      rollbackAction: 'Retrieve object from placement',
    },
  ],
  [SOPNodeType.CHECKPOINT]: [
    {
      actionType: 'WAIT',
      description: 'Pause at checkpoint for human review',
      safetyConstraints: ['Maintain safe idle posture', 'Signal checkpoint status'],
    },
    {
      actionType: 'COMMUNICATE',
      description: 'Report checkpoint status to supervisor',
      safetyConstraints: ['Wait for acknowledgement before proceeding'],
    },
  ],
  [SOPNodeType.ESCALATION]: [
    {
      actionType: 'WAIT',
      description: 'Halt current task and await escalation resolution',
      safetyConstraints: ['Enter safe mode immediately', 'Alert all nearby operators'],
    },
    {
      actionType: 'COMMUNICATE',
      description: 'Broadcast escalation to supervisors',
      safetyConstraints: ['Ensure escalation is acknowledged'],
    },
  ],
  [SOPNodeType.DOCUMENTATION]: [
    {
      actionType: 'INSPECT',
      description: 'Capture documentation data (photos, measurements, logs)',
      safetyConstraints: ['Do not interfere with ongoing operations'],
    },
  ],
  [SOPNodeType.HANDOVER]: [
    {
      actionType: 'COMMUNICATE',
      description: 'Initiate handover protocol with receiving party',
      safetyConstraints: ['Verify receiving party identity', 'Transfer context completely'],
    },
    {
      actionType: 'WAIT',
      description: 'Wait for handover acknowledgement',
      safetyConstraints: ['Do not disengage until handover is confirmed'],
    },
  ],
};

// --- Pure functions ---

/**
 * Translate a cognitive SOP node into a sequence of physical actions for a given modality.
 */
export function translateTask(
  sopNode: SOPNode,
  modality: InterfaceModality,
  context: TranslationContext,
): TaskTranslation {
  const patterns = NODE_ACTION_PATTERNS[sopNode.type] ?? [
    {
      actionType: 'COMMUNICATE' as PhysicalActionType,
      description: `Execute: ${sopNode.label}`,
      safetyConstraints: ['Follow general safety protocol'],
    },
  ];

  const physicalActions: PhysicalAction[] = patterns.map((pattern, idx) => ({
    id: randomUUID(),
    sequence: idx + 1,
    description: pattern.description,
    actionType: pattern.actionType,
    parameters: {
      sopNodeId: sopNode.id,
      sopNodeType: sopNode.type,
      nodeLabel: sopNode.label,
      ...sopNode.config,
    },
    safetyConstraints: [
      ...pattern.safetyConstraints,
      ...getContextSafetyConstraints(context),
    ],
    rollbackAction: pattern.rollbackAction,
  }));

  const riskAssessment = assessRisk(sopNode, modality, context);
  const requiredAuthLevel = determineAuthLevel(riskAssessment, modality);
  const estimatedDuration = estimateDuration(physicalActions, modality);

  return {
    cognitiveTask: `${sopNode.type}: ${sopNode.label}`,
    physicalActions,
    requiredAuthLevel,
    riskAssessment,
    estimatedDuration,
  };
}

/**
 * Assess risk based on node type, modality, and environmental context.
 */
function assessRisk(
  sopNode: SOPNode,
  modality: InterfaceModality,
  context: TranslationContext,
): RiskAssessment {
  const factors: string[] = [];
  let riskScore = 0;

  // Modality risk
  const modalityWeight = MODALITY_RISK_WEIGHT[modality] ?? 0;
  riskScore += modalityWeight;
  if (modalityWeight >= 3) {
    factors.push(`High-autonomy modality: ${modality}`);
  }

  // Physical action nodes are inherently riskier
  if (sopNode.type === SOPNodeType.ACTION_PHYSICAL) {
    riskScore += 3;
    factors.push('Physical action node — involves real-world manipulation');
  }

  // Escalation nodes indicate abnormal conditions
  if (sopNode.type === SOPNodeType.ESCALATION) {
    riskScore += 2;
    factors.push('Escalation node — abnormal condition detected');
  }

  // Human proximity
  if (context.humanProximity) {
    riskScore += 2;
    factors.push('Humans in proximity — collision/injury risk');
  }

  // Medical context
  if (context.medicalContext) {
    riskScore += 3;
    factors.push('Medical context — patient safety critical');
  }

  // Hazardous environment
  if (context.environmentType === 'HAZARDOUS') {
    riskScore += 2;
    factors.push('Hazardous environment — additional safety protocols required');
  }

  const overallRisk = scoreToSeverity(riskScore);

  return {
    overallRisk,
    humanProximity: context.humanProximity,
    reversible: sopNode.type !== SOPNodeType.ACTION_PHYSICAL,
    medicalContext: context.medicalContext,
    factors,
  };
}

/**
 * Determine the required authorization level based on risk and modality.
 */
function determineAuthLevel(
  risk: RiskAssessment,
  modality: InterfaceModality,
): ActionAuthLevel {
  // Digital-only modalities never need physical auth
  const digitalOnly = ['CHAT', 'VOICE', 'AVATAR'];
  if (digitalOnly.includes(modality)) {
    return ActionAuthLevel.L1_OBSERVE;
  }

  // Critical risk or medical context always requires approval
  if (risk.overallRisk === 'CRITICAL' || risk.medicalContext) {
    return ActionAuthLevel.L3_ACT_WITH_APPROVAL;
  }

  // High risk needs approval
  if (risk.overallRisk === 'HIGH') {
    return ActionAuthLevel.L3_ACT_WITH_APPROVAL;
  }

  // Medium risk with humans nearby needs approval
  if (risk.overallRisk === 'MEDIUM' && risk.humanProximity) {
    return ActionAuthLevel.L3_ACT_WITH_APPROVAL;
  }

  // Medium risk without humans can act and notify
  if (risk.overallRisk === 'MEDIUM') {
    return ActionAuthLevel.L4_ACT_NOTIFY;
  }

  // Low risk on autonomous modalities
  if (modality === 'FULLY_AUTONOMOUS' || modality === 'SEMI_AUTONOMOUS') {
    return ActionAuthLevel.L5_AUTONOMOUS;
  }

  return ActionAuthLevel.L2_SUGGEST;
}

/**
 * Estimate total duration in seconds for physical actions based on modality.
 */
function estimateDuration(actions: PhysicalAction[], modality: InterfaceModality): number {
  const BASE_SECONDS_PER_ACTION: Record<PhysicalActionType, number> = {
    MOVE: 15,
    GRASP: 8,
    PLACE: 10,
    INSPECT: 12,
    COMMUNICATE: 5,
    WAIT: 10,
  };

  // Slower for more physical modalities (safety overhead)
  const modalityMultiplier = 1 + (MODALITY_RISK_WEIGHT[modality] ?? 0) * 0.2;

  return Math.round(
    actions.reduce((sum, action) => {
      const base = BASE_SECONDS_PER_ACTION[action.actionType] ?? 10;
      return sum + base * modalityMultiplier;
    }, 0),
  );
}

function scoreToSeverity(score: number): RiskSeverity {
  if (score >= 8) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

function getContextSafetyConstraints(context: TranslationContext): string[] {
  const constraints: string[] = [];

  if (context.humanProximity) {
    constraints.push('Human proximity detected — reduce speed and force limits');
  }
  if (context.medicalContext) {
    constraints.push('Medical context — follow sterile protocols');
  }
  if (context.environmentType === 'HAZARDOUS') {
    constraints.push('Hazardous environment — use protective measures');
  }
  if (context.environmentType === 'CLEANROOM') {
    constraints.push('Cleanroom environment — maintain contamination controls');
  }

  return constraints;
}
