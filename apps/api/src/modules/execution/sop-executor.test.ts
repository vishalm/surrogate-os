import { describe, it, expect } from 'vitest';
import { SOPNodeType } from '@surrogate-os/shared';
import type { SOPGraph, SOPNode, SOPEdge } from '@surrogate-os/shared';
import { SOPExecutor } from './sop-executor.js';
import type { ExecutionState } from './sop-executor.js';

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

function makeEdge(
  from: string,
  to: string,
  id?: string,
  overrides?: Partial<SOPEdge>,
): SOPEdge {
  return {
    id: id ?? `${from}->${to}`,
    from,
    to,
    condition: null,
    label: null,
    ...overrides,
  };
}

function makeGraph(nodes: SOPNode[], edges: SOPEdge[]): SOPGraph {
  return { nodes, edges };
}

/** Build a simple linear graph: A -> B -> C -> D (end) */
function makeLinearGraph(): SOPGraph {
  return makeGraph(
    [
      makeNode('a', SOPNodeType.INFORMATION_GATHER),
      makeNode('b', SOPNodeType.ASSESSMENT),
      makeNode('c', SOPNodeType.ACTION_DIGITAL),
      makeNode('d', SOPNodeType.DOCUMENTATION),
    ],
    [
      makeEdge('a', 'b'),
      makeEdge('b', 'c'),
      makeEdge('c', 'd'),
    ],
  );
}

describe('SOPExecutor', () => {
  const sessionId = 'session-1';
  const surrogateId = 'surrogate-1';
  const sopId = 'sop-1';

  describe('start()', () => {
    it('finds the START node (no incoming edges) and initializes state correctly', () => {
      const graph = makeLinearGraph();
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);

      expect(state.sessionId).toBe(sessionId);
      expect(state.surrogateId).toBe(surrogateId);
      expect(state.sopId).toBe(sopId);
      expect(state.currentNodeId).toBe('a');
      expect(state.visitedNodes).toEqual(['a']);
      expect(state.decisions).toEqual([]);
      expect(state.startedAt).toBeInstanceOf(Date);
      expect(state.context).toEqual({});
    });

    it('sets AWAITING_INPUT status for INFORMATION_GATHER start node', () => {
      const graph = makeGraph(
        [makeNode('start', SOPNodeType.INFORMATION_GATHER)],
        [],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      expect(state.status).toBe('AWAITING_INPUT');
    });

    it('sets AWAITING_ESCALATION status for ESCALATION start node', () => {
      const graph = makeGraph(
        [makeNode('esc', SOPNodeType.ESCALATION)],
        [],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      expect(state.status).toBe('AWAITING_ESCALATION');
    });

    it('sets RUNNING status for non-special start node types', () => {
      const graph = makeGraph(
        [
          makeNode('start', SOPNodeType.ACTION_DIGITAL),
          makeNode('end', SOPNodeType.DOCUMENTATION),
        ],
        [makeEdge('start', 'end')],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      expect(state.status).toBe('RUNNING');
    });

    it('throws if there is no valid start node (all nodes have incoming edges)', () => {
      // Create a graph where every node has an incoming edge (cycle)
      const graph = makeGraph(
        [
          makeNode('a', SOPNodeType.ASSESSMENT),
          makeNode('b', SOPNodeType.DECISION),
        ],
        [
          makeEdge('a', 'b'),
          makeEdge('b', 'a'),
        ],
      );
      expect(() => SOPExecutor.start(graph, sessionId, surrogateId, sopId)).toThrow(
        'SOP graph has no start node',
      );
    });

    it('throws for an empty graph with no nodes', () => {
      const graph = makeGraph([], []);
      expect(() => SOPExecutor.start(graph, sessionId, surrogateId, sopId)).toThrow(
        'SOP graph has no start node',
      );
    });
  });

  describe('advance()', () => {
    it('moves to the next node via a valid edge', () => {
      const graph = makeLinearGraph();
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);

      const next = SOPExecutor.advance(state, graph, {
        edgeId: 'a->b',
        decision: 'proceed',
        confidence: 0.9,
      });

      expect(next.currentNodeId).toBe('b');
      expect(next.visitedNodes).toEqual(['a', 'b']);
      expect(next.decisions).toHaveLength(1);
      expect(next.decisions[0].nodeId).toBe('a');
      expect(next.decisions[0].edgeId).toBe('a->b');
      expect(next.decisions[0].decision).toBe('proceed');
      expect(next.decisions[0].confidence).toBe(0.9);
    });

    it('throws on invalid edge (non-existent)', () => {
      const graph = makeLinearGraph();
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);

      expect(() =>
        SOPExecutor.advance(state, graph, {
          edgeId: 'fake-edge',
          decision: 'proceed',
          confidence: 1,
        }),
      ).toThrow('Edge fake-edge not found in SOP graph');
    });

    it('throws when edge does not originate from current node', () => {
      const graph = makeLinearGraph();
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);

      expect(() =>
        SOPExecutor.advance(state, graph, {
          edgeId: 'b->c',
          decision: 'proceed',
          confidence: 1,
        }),
      ).toThrow('does not originate from current node');
    });

    it('sets AWAITING_ESCALATION status when advancing to an ESCALATION node', () => {
      const graph = makeGraph(
        [
          makeNode('start', SOPNodeType.ACTION_DIGITAL),
          makeNode('esc', SOPNodeType.ESCALATION),
          makeNode('end', SOPNodeType.DOCUMENTATION),
        ],
        [
          makeEdge('start', 'esc'),
          makeEdge('esc', 'end'),
        ],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      const next = SOPExecutor.advance(state, graph, {
        edgeId: 'start->esc',
        decision: 'escalate',
        confidence: 0.5,
      });

      expect(next.status).toBe('AWAITING_ESCALATION');
      expect(next.currentNodeId).toBe('esc');
    });

    it('sets AWAITING_INPUT status when advancing to a DECISION node', () => {
      const graph = makeGraph(
        [
          makeNode('start', SOPNodeType.ACTION_DIGITAL),
          makeNode('dec', SOPNodeType.DECISION),
          makeNode('end', SOPNodeType.DOCUMENTATION),
        ],
        [
          makeEdge('start', 'dec'),
          makeEdge('dec', 'end'),
        ],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      const next = SOPExecutor.advance(state, graph, {
        edgeId: 'start->dec',
        decision: 'decide',
        confidence: 0.8,
      });

      expect(next.status).toBe('AWAITING_INPUT');
    });

    it('sets COMPLETED status when advancing to an END node (no outgoing edges)', () => {
      const graph = makeGraph(
        [
          makeNode('start', SOPNodeType.ACTION_DIGITAL),
          makeNode('end', SOPNodeType.DOCUMENTATION),
        ],
        [makeEdge('start', 'end')],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      const next = SOPExecutor.advance(state, graph, {
        edgeId: 'start->end',
        decision: 'done',
        confidence: 1,
      });

      expect(next.status).toBe('COMPLETED');
    });

    it('throws when trying to advance from COMPLETED status', () => {
      const graph = makeGraph(
        [
          makeNode('start', SOPNodeType.ACTION_DIGITAL),
          makeNode('end', SOPNodeType.DOCUMENTATION),
        ],
        [makeEdge('start', 'end')],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      const completed = SOPExecutor.advance(state, graph, {
        edgeId: 'start->end',
        decision: 'done',
        confidence: 1,
      });

      expect(() =>
        SOPExecutor.advance(completed, graph, {
          edgeId: 'start->end',
          decision: 'again',
          confidence: 1,
        }),
      ).toThrow('Cannot advance execution in COMPLETED status');
    });

    it('throws when trying to advance from ABORTED status', () => {
      const graph = makeLinearGraph();
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      const aborted: ExecutionState = { ...state, status: 'ABORTED' };

      expect(() =>
        SOPExecutor.advance(aborted, graph, {
          edgeId: 'a->b',
          decision: 'proceed',
          confidence: 1,
        }),
      ).toThrow('Cannot advance execution in ABORTED status');
    });

    it('merges input into context when provided', () => {
      const graph = makeLinearGraph();
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);

      const next = SOPExecutor.advance(state, graph, {
        edgeId: 'a->b',
        decision: 'proceed',
        confidence: 1,
        input: { key: 'value', nested: { deep: true } },
      });

      expect(next.context).toEqual({ key: 'value', nested: { deep: true } });
    });

    it('preserves existing context when advancing with new input', () => {
      const graph = makeLinearGraph();
      let state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);

      state = SOPExecutor.advance(state, graph, {
        edgeId: 'a->b',
        decision: 'step1',
        confidence: 1,
        input: { first: 'data' },
      });

      state = SOPExecutor.advance(state, graph, {
        edgeId: 'b->c',
        decision: 'step2',
        confidence: 1,
        input: { second: 'data' },
      });

      expect(state.context).toEqual({ first: 'data', second: 'data' });
    });
  });

  describe('getAvailableTransitions()', () => {
    it('returns outgoing edges from the current node', () => {
      const graph = makeGraph(
        [
          makeNode('a', SOPNodeType.DECISION),
          makeNode('b', SOPNodeType.ACTION_DIGITAL),
          makeNode('c', SOPNodeType.ESCALATION),
        ],
        [
          makeEdge('a', 'b', 'e1', { label: 'approve', condition: 'score > 0.8' }),
          makeEdge('a', 'c', 'e2', { label: 'escalate', condition: 'score <= 0.8' }),
        ],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      const transitions = SOPExecutor.getAvailableTransitions(state, graph);

      expect(transitions).toHaveLength(2);
      expect(transitions[0]).toEqual({
        edgeId: 'e1',
        label: 'approve',
        condition: 'score > 0.8',
        targetNodeId: 'b',
      });
      expect(transitions[1]).toEqual({
        edgeId: 'e2',
        label: 'escalate',
        condition: 'score <= 0.8',
        targetNodeId: 'c',
      });
    });

    it('returns empty array for an END node (no outgoing edges)', () => {
      const graph = makeGraph(
        [
          makeNode('start', SOPNodeType.ACTION_DIGITAL),
          makeNode('end', SOPNodeType.DOCUMENTATION),
        ],
        [makeEdge('start', 'end')],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      const completed = SOPExecutor.advance(state, graph, {
        edgeId: 'start->end',
        decision: 'done',
        confidence: 1,
      });

      const transitions = SOPExecutor.getAvailableTransitions(completed, graph);
      expect(transitions).toHaveLength(0);
    });
  });

  describe('requiresEscalation()', () => {
    it('returns true when current node is ESCALATION type', () => {
      const graph = makeGraph(
        [makeNode('esc', SOPNodeType.ESCALATION)],
        [],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      expect(SOPExecutor.requiresEscalation(state, graph)).toBe(true);
    });

    it('returns false when current node is not ESCALATION type', () => {
      const graph = makeGraph(
        [makeNode('info', SOPNodeType.INFORMATION_GATHER)],
        [],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      expect(SOPExecutor.requiresEscalation(state, graph)).toBe(false);
    });
  });

  describe('isCheckpoint()', () => {
    it('returns true when current node is CHECKPOINT type', () => {
      const graph = makeGraph(
        [makeNode('cp', SOPNodeType.CHECKPOINT)],
        [],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      expect(SOPExecutor.isCheckpoint(state, graph)).toBe(true);
    });

    it('returns false when current node is not CHECKPOINT type', () => {
      const graph = makeGraph(
        [makeNode('action', SOPNodeType.ACTION_DIGITAL)],
        [],
      );
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      expect(SOPExecutor.isCheckpoint(state, graph)).toBe(false);
    });
  });

  describe('getProgress()', () => {
    it('calculates correct percentage for partial traversal', () => {
      const graph = makeLinearGraph(); // 4 nodes
      const state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);

      const progress = SOPExecutor.getProgress(state, graph);
      expect(progress.visited).toBe(1);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBe(25);
    });

    it('calculates 50% after visiting 2 of 4 nodes', () => {
      const graph = makeLinearGraph();
      let state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      state = SOPExecutor.advance(state, graph, {
        edgeId: 'a->b',
        decision: 'next',
        confidence: 1,
      });

      const progress = SOPExecutor.getProgress(state, graph);
      expect(progress.visited).toBe(2);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBe(50);
    });

    it('returns 100% after visiting all nodes', () => {
      const graph = makeLinearGraph();
      let state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      state = SOPExecutor.advance(state, graph, { edgeId: 'a->b', decision: 'next', confidence: 1 });
      state = SOPExecutor.advance(state, graph, { edgeId: 'b->c', decision: 'next', confidence: 1 });
      state = SOPExecutor.advance(state, graph, { edgeId: 'c->d', decision: 'next', confidence: 1 });

      const progress = SOPExecutor.getProgress(state, graph);
      expect(progress.visited).toBe(4);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBe(100);
    });

    it('deduplicates visited nodes when counting', () => {
      const graph = makeGraph(
        [
          makeNode('a', SOPNodeType.ACTION_DIGITAL),
          makeNode('b', SOPNodeType.ACTION_DIGITAL),
        ],
        [makeEdge('a', 'b'), makeEdge('b', 'a', 'b->a')],
      );
      // Build state manually since this graph has a cycle and findStartNode
      // relies on no-incoming-edge heuristic. We construct state as if we
      // started at 'a', went to 'b', then back to 'a'.
      const state: ExecutionState = {
        sessionId,
        surrogateId,
        sopId,
        currentNodeId: 'a',
        visitedNodes: ['a', 'b', 'a'],
        decisions: [
          { nodeId: 'a', edgeId: 'a->b', decision: 'go', confidence: 1, timestamp: new Date() },
          { nodeId: 'b', edgeId: 'b->a', decision: 'back', confidence: 1, timestamp: new Date() },
        ],
        status: 'RUNNING',
        startedAt: new Date(),
        context: {},
      };

      const progress = SOPExecutor.getProgress(state, graph);
      // visitedNodes = ['a', 'b', 'a'], but Set deduplicates => 2 unique
      expect(progress.visited).toBe(2);
      expect(progress.total).toBe(2);
      expect(progress.percentage).toBe(100);
    });

    it('returns 0% for an empty graph', () => {
      const graph = makeGraph([], []);
      const state: ExecutionState = {
        sessionId,
        surrogateId,
        sopId,
        currentNodeId: 'none',
        visitedNodes: [],
        decisions: [],
        status: 'RUNNING',
        startedAt: new Date(),
        context: {},
      };
      const progress = SOPExecutor.getProgress(state, graph);
      expect(progress.percentage).toBe(0);
    });
  });

  describe('validatePath()', () => {
    it('returns valid for a clean execution path', () => {
      const graph = makeLinearGraph();
      let state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      state = SOPExecutor.advance(state, graph, { edgeId: 'a->b', decision: 'ok', confidence: 1 });
      state = SOPExecutor.advance(state, graph, { edgeId: 'b->c', decision: 'ok', confidence: 1 });

      const validation = SOPExecutor.validatePath(state, graph);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('detects visited node that does not exist in graph', () => {
      const graph = makeLinearGraph();
      const state: ExecutionState = {
        sessionId,
        surrogateId,
        sopId,
        currentNodeId: 'a',
        visitedNodes: ['a', 'nonexistent'],
        decisions: [],
        status: 'RUNNING',
        startedAt: new Date(),
        context: {},
      };

      const validation = SOPExecutor.validatePath(state, graph);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('nonexistent'))).toBe(true);
    });

    it('detects current node that does not exist in graph', () => {
      const graph = makeLinearGraph();
      const state: ExecutionState = {
        sessionId,
        surrogateId,
        sopId,
        currentNodeId: 'missing-node',
        visitedNodes: ['missing-node'],
        decisions: [],
        status: 'RUNNING',
        startedAt: new Date(),
        context: {},
      };

      const validation = SOPExecutor.validatePath(state, graph);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('missing-node'))).toBe(true);
    });

    it('detects decision edges that do not exist in graph', () => {
      const graph = makeLinearGraph();
      const state: ExecutionState = {
        sessionId,
        surrogateId,
        sopId,
        currentNodeId: 'b',
        visitedNodes: ['a', 'b'],
        decisions: [
          { nodeId: 'a', edgeId: 'fake-edge', decision: 'go', confidence: 1, timestamp: new Date() },
        ],
        status: 'RUNNING',
        startedAt: new Date(),
        context: {},
      };

      const validation = SOPExecutor.validatePath(state, graph);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('fake-edge'))).toBe(true);
    });
  });

  describe('full execution: start -> advance through multiple nodes -> complete', () => {
    it('executes a full SOP graph from start to end', () => {
      const graph = makeLinearGraph();

      let state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      expect(state.status).toBe('AWAITING_INPUT'); // INFORMATION_GATHER

      state = SOPExecutor.advance(state, graph, {
        edgeId: 'a->b',
        decision: 'gathered info',
        confidence: 0.95,
        input: { findings: 'all clear' },
      });
      expect(state.currentNodeId).toBe('b');
      expect(state.status).toBe('RUNNING'); // ASSESSMENT

      state = SOPExecutor.advance(state, graph, {
        edgeId: 'b->c',
        decision: 'assessment complete',
        confidence: 0.88,
      });
      expect(state.currentNodeId).toBe('c');
      expect(state.status).toBe('RUNNING'); // ACTION_DIGITAL

      state = SOPExecutor.advance(state, graph, {
        edgeId: 'c->d',
        decision: 'action taken',
        confidence: 1.0,
      });
      expect(state.currentNodeId).toBe('d');
      expect(state.status).toBe('COMPLETED'); // END node (no outgoing edges)

      // Verify full path
      expect(state.visitedNodes).toEqual(['a', 'b', 'c', 'd']);
      expect(state.decisions).toHaveLength(3);
      expect(state.context).toEqual({ findings: 'all clear' });

      // Validate path consistency
      const validation = SOPExecutor.validatePath(state, graph);
      expect(validation.valid).toBe(true);

      // Progress should be 100%
      const progress = SOPExecutor.getProgress(state, graph);
      expect(progress.percentage).toBe(100);
    });

    it('handles branching execution with decision nodes', () => {
      const graph = makeGraph(
        [
          makeNode('start', SOPNodeType.INFORMATION_GATHER),
          makeNode('decide', SOPNodeType.DECISION),
          makeNode('approve', SOPNodeType.ACTION_DIGITAL),
          makeNode('reject', SOPNodeType.ESCALATION),
          makeNode('end', SOPNodeType.DOCUMENTATION),
        ],
        [
          makeEdge('start', 'decide'),
          makeEdge('decide', 'approve', 'yes'),
          makeEdge('decide', 'reject', 'no'),
          makeEdge('approve', 'end'),
          makeEdge('reject', 'end'),
        ],
      );

      let state = SOPExecutor.start(graph, sessionId, surrogateId, sopId);
      state = SOPExecutor.advance(state, graph, {
        edgeId: 'start->decide',
        decision: 'reviewed',
        confidence: 0.9,
      });

      expect(state.status).toBe('AWAITING_INPUT'); // DECISION node

      // Take the "approve" branch
      state = SOPExecutor.advance(state, graph, {
        edgeId: 'yes',
        decision: 'approved',
        confidence: 0.95,
      });
      expect(state.currentNodeId).toBe('approve');

      state = SOPExecutor.advance(state, graph, {
        edgeId: 'approve->end',
        decision: 'completed',
        confidence: 1,
      });
      expect(state.status).toBe('COMPLETED');

      const validation = SOPExecutor.validatePath(state, graph);
      expect(validation.valid).toBe(true);
    });
  });
});
