import { describe, it, expect } from 'vitest';
import { SOPNodeType } from '@surrogate-os/shared';
import type { SOPNode, SOPEdge, SOPGraph } from '@surrogate-os/shared';
import { validateSOPGraph, computeGraphConfidence } from './graph-validator.js';

function makeNode(id: string, type: SOPNodeType): SOPNode {
  return { id, type, label: `Node ${id}`, description: `Description for ${id}`, config: {} };
}

function makeEdge(from: string, to: string, id?: string): SOPEdge {
  return { id: id ?? `${from}->${to}`, from, to, condition: null, label: null };
}

describe('validateSOPGraph', () => {
  it('accepts a valid DAG with escalation and checkpoint nodes', () => {
    const graph: SOPGraph = {
      nodes: [
        makeNode('start', SOPNodeType.INFORMATION_GATHER),
        makeNode('assess', SOPNodeType.ASSESSMENT),
        makeNode('decide', SOPNodeType.DECISION),
        makeNode('act', SOPNodeType.ACTION_DIGITAL),
        makeNode('check', SOPNodeType.CHECKPOINT),
        makeNode('escalate', SOPNodeType.ESCALATION),
        makeNode('doc', SOPNodeType.DOCUMENTATION),
      ],
      edges: [
        makeEdge('start', 'assess'),
        makeEdge('assess', 'decide'),
        makeEdge('decide', 'act'),
        makeEdge('decide', 'escalate'),
        makeEdge('act', 'check'),
        makeEdge('check', 'doc'),
      ],
    };

    const result = validateSOPGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects a cycle (A->B->C->A)', () => {
    const graph: SOPGraph = {
      nodes: [
        makeNode('a', SOPNodeType.INFORMATION_GATHER),
        makeNode('b', SOPNodeType.CHECKPOINT),
        makeNode('c', SOPNodeType.ESCALATION),
      ],
      edges: [
        makeEdge('a', 'b'),
        makeEdge('b', 'c'),
        makeEdge('c', 'a'),
      ],
    };

    const result = validateSOPGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('cycle'))).toBe(true);
  });

  it('fails when graph is missing an ESCALATION node', () => {
    const graph: SOPGraph = {
      nodes: [
        makeNode('start', SOPNodeType.INFORMATION_GATHER),
        makeNode('check', SOPNodeType.CHECKPOINT),
      ],
      edges: [makeEdge('start', 'check')],
    };

    const result = validateSOPGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ESCALATION'))).toBe(true);
  });

  it('fails when graph is missing a CHECKPOINT node', () => {
    const graph: SOPGraph = {
      nodes: [
        makeNode('start', SOPNodeType.INFORMATION_GATHER),
        makeNode('escalate', SOPNodeType.ESCALATION),
      ],
      edges: [makeEdge('start', 'escalate')],
    };

    const result = validateSOPGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('CHECKPOINT'))).toBe(true);
  });

  it('fails when an edge references a non-existent node', () => {
    const graph: SOPGraph = {
      nodes: [
        makeNode('start', SOPNodeType.INFORMATION_GATHER),
        makeNode('check', SOPNodeType.CHECKPOINT),
        makeNode('escalate', SOPNodeType.ESCALATION),
      ],
      edges: [
        makeEdge('start', 'check'),
        makeEdge('start', 'escalate'),
        makeEdge('start', 'ghost-node'),
      ],
    };

    const result = validateSOPGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('non-existent') && e.includes('ghost-node'))).toBe(true);
  });

  it('fails when there are duplicate node IDs', () => {
    const graph: SOPGraph = {
      nodes: [
        makeNode('dup', SOPNodeType.INFORMATION_GATHER),
        makeNode('dup', SOPNodeType.CHECKPOINT),
        makeNode('escalate', SOPNodeType.ESCALATION),
      ],
      edges: [
        makeEdge('dup', 'escalate'),
      ],
    };

    const result = validateSOPGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate') && e.includes('dup'))).toBe(true);
  });

  it('fails for a single node graph missing escalation and checkpoint', () => {
    const graph: SOPGraph = {
      nodes: [makeNode('only', SOPNodeType.INFORMATION_GATHER)],
      edges: [],
    };

    const result = validateSOPGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ESCALATION'))).toBe(true);
    expect(result.errors.some((e) => e.includes('CHECKPOINT'))).toBe(true);
  });

  it('fails for an orphan node with no connections', () => {
    const graph: SOPGraph = {
      nodes: [
        makeNode('start', SOPNodeType.INFORMATION_GATHER),
        makeNode('connected', SOPNodeType.ASSESSMENT),
        makeNode('orphan', SOPNodeType.ACTION_DIGITAL),
        makeNode('check', SOPNodeType.CHECKPOINT),
        makeNode('escalate', SOPNodeType.ESCALATION),
      ],
      edges: [
        makeEdge('start', 'connected'),
        makeEdge('connected', 'check'),
        makeEdge('check', 'escalate'),
      ],
    };

    const result = validateSOPGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Orphan') && e.includes('orphan'))).toBe(true);
  });

  it('returns an error for an empty graph (no nodes)', () => {
    const graph: SOPGraph = { nodes: [], edges: [] };
    const result = validateSOPGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('at least one node'))).toBe(true);
  });
});

describe('computeGraphConfidence', () => {
  it('returns > 0.8 for a valid complex graph with decision branching', () => {
    const graph: SOPGraph = {
      nodes: [
        makeNode('gather', SOPNodeType.INFORMATION_GATHER),
        makeNode('assess', SOPNodeType.ASSESSMENT),
        makeNode('decide', SOPNodeType.DECISION),
        makeNode('act-a', SOPNodeType.ACTION_DIGITAL),
        makeNode('act-b', SOPNodeType.ACTION_PHYSICAL),
        makeNode('check', SOPNodeType.CHECKPOINT),
        makeNode('escalate', SOPNodeType.ESCALATION),
        makeNode('doc', SOPNodeType.DOCUMENTATION),
        makeNode('handover', SOPNodeType.HANDOVER),
        makeNode('decide2', SOPNodeType.DECISION),
      ],
      edges: [
        makeEdge('gather', 'assess'),
        makeEdge('assess', 'decide'),
        makeEdge('decide', 'act-a'),
        makeEdge('decide', 'act-b'),
        makeEdge('act-a', 'check'),
        makeEdge('act-b', 'escalate'),
        makeEdge('check', 'doc'),
        makeEdge('doc', 'decide2'),
        makeEdge('decide2', 'handover'),
        makeEdge('decide2', 'escalate'),
      ],
    };

    const validation = validateSOPGraph(graph);
    expect(validation.valid).toBe(true);

    const confidence = computeGraphConfidence(graph, validation);
    expect(confidence).toBeGreaterThan(0.8);
  });

  it('returns ~0.5-0.6 for a minimal valid graph', () => {
    const graph: SOPGraph = {
      nodes: [
        makeNode('start', SOPNodeType.INFORMATION_GATHER),
        makeNode('check', SOPNodeType.CHECKPOINT),
        makeNode('escalate', SOPNodeType.ESCALATION),
      ],
      edges: [
        makeEdge('start', 'check'),
        makeEdge('check', 'escalate'),
      ],
    };

    const validation = validateSOPGraph(graph);
    expect(validation.valid).toBe(true);

    const confidence = computeGraphConfidence(graph, validation);
    expect(confidence).toBeGreaterThanOrEqual(0.5);
    expect(confidence).toBeLessThanOrEqual(0.8);
  });

  it('returns a lower score for an invalid graph', () => {
    const invalidGraph: SOPGraph = {
      nodes: [makeNode('lonely', SOPNodeType.INFORMATION_GATHER)],
      edges: [],
    };
    const invalidValidation = validateSOPGraph(invalidGraph);
    expect(invalidValidation.valid).toBe(false);

    const validGraph: SOPGraph = {
      nodes: [
        makeNode('start', SOPNodeType.INFORMATION_GATHER),
        makeNode('check', SOPNodeType.CHECKPOINT),
        makeNode('escalate', SOPNodeType.ESCALATION),
      ],
      edges: [
        makeEdge('start', 'check'),
        makeEdge('check', 'escalate'),
      ],
    };
    const validValidation = validateSOPGraph(validGraph);

    const invalidScore = computeGraphConfidence(invalidGraph, invalidValidation);
    const validScore = computeGraphConfidence(validGraph, validValidation);

    expect(invalidScore).toBeLessThan(validScore);
  });
});
