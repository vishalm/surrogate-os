import { describe, it, expect } from 'vitest';
import { SOPNodeType } from '@surrogate-os/shared';
import type { SOPNode, SOPEdge, SOPGraph } from '@surrogate-os/shared';
import { computeGraphDiff } from './graph-diff.js';

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

describe('computeGraphDiff', () => {
  describe('node diffs', () => {
    it('returns empty diff for identical graphs', () => {
      const graph = makeGraph(
        [
          makeNode('a', SOPNodeType.INFORMATION_GATHER),
          makeNode('b', SOPNodeType.ASSESSMENT),
        ],
        [makeEdge('a', 'b')],
      );

      const diff = computeGraphDiff(graph, graph);

      expect(diff.addedNodes).toHaveLength(0);
      expect(diff.removedNodes).toHaveLength(0);
      expect(diff.modifiedNodes).toHaveLength(0);
      expect(diff.addedEdges).toHaveLength(0);
      expect(diff.removedEdges).toHaveLength(0);
      expect(diff.modifiedEdges).toHaveLength(0);
      expect(diff.summary).toBe('No changes');
    });

    it('detects added nodes', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER)],
        [],
      );
      const proposed = makeGraph(
        [
          makeNode('a', SOPNodeType.INFORMATION_GATHER),
          makeNode('b', SOPNodeType.ASSESSMENT),
        ],
        [],
      );

      const diff = computeGraphDiff(current, proposed);

      expect(diff.addedNodes).toHaveLength(1);
      expect(diff.addedNodes[0].id).toBe('b');
      expect(diff.removedNodes).toHaveLength(0);
      expect(diff.modifiedNodes).toHaveLength(0);
    });

    it('detects removed nodes', () => {
      const current = makeGraph(
        [
          makeNode('a', SOPNodeType.INFORMATION_GATHER),
          makeNode('b', SOPNodeType.ASSESSMENT),
        ],
        [],
      );
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER)],
        [],
      );

      const diff = computeGraphDiff(current, proposed);

      expect(diff.removedNodes).toHaveLength(1);
      expect(diff.removedNodes[0].id).toBe('b');
      expect(diff.addedNodes).toHaveLength(0);
      expect(diff.modifiedNodes).toHaveLength(0);
    });

    it('detects modified nodes when label changes', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER)],
        [],
      );
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER, { label: 'Updated Label' })],
        [],
      );

      const diff = computeGraphDiff(current, proposed);

      expect(diff.modifiedNodes).toHaveLength(1);
      expect(diff.modifiedNodes[0].before.label).toBe('Node a');
      expect(diff.modifiedNodes[0].after.label).toBe('Updated Label');
    });

    it('detects modified nodes when type changes', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER)],
        [],
      );
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.DECISION)],
        [],
      );

      const diff = computeGraphDiff(current, proposed);

      expect(diff.modifiedNodes).toHaveLength(1);
      expect(diff.modifiedNodes[0].before.type).toBe(SOPNodeType.INFORMATION_GATHER);
      expect(diff.modifiedNodes[0].after.type).toBe(SOPNodeType.DECISION);
    });

    it('detects modified nodes when description changes', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER)],
        [],
      );
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER, { description: 'New description' })],
        [],
      );

      const diff = computeGraphDiff(current, proposed);

      expect(diff.modifiedNodes).toHaveLength(1);
      expect(diff.modifiedNodes[0].after.description).toBe('New description');
    });

    it('does not mark nodes as modified when only config differs', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER, { config: { key: 'old' } })],
        [],
      );
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER, { config: { key: 'new' } })],
        [],
      );

      const diff = computeGraphDiff(current, proposed);

      // config is not checked by isNodeModified
      expect(diff.modifiedNodes).toHaveLength(0);
    });
  });

  describe('edge diffs', () => {
    it('detects added edges', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER), makeNode('b', SOPNodeType.ASSESSMENT)],
        [],
      );
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER), makeNode('b', SOPNodeType.ASSESSMENT)],
        [makeEdge('a', 'b')],
      );

      const diff = computeGraphDiff(current, proposed);

      expect(diff.addedEdges).toHaveLength(1);
      expect(diff.addedEdges[0].id).toBe('a->b');
      expect(diff.removedEdges).toHaveLength(0);
    });

    it('detects removed edges', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER), makeNode('b', SOPNodeType.ASSESSMENT)],
        [makeEdge('a', 'b')],
      );
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER), makeNode('b', SOPNodeType.ASSESSMENT)],
        [],
      );

      const diff = computeGraphDiff(current, proposed);

      expect(diff.removedEdges).toHaveLength(1);
      expect(diff.removedEdges[0].id).toBe('a->b');
      expect(diff.addedEdges).toHaveLength(0);
    });

    it('detects modified edges when condition changes', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.DECISION), makeNode('b', SOPNodeType.ACTION_DIGITAL)],
        [makeEdge('a', 'b', 'e1')],
      );
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.DECISION), makeNode('b', SOPNodeType.ACTION_DIGITAL)],
        [makeEdge('a', 'b', 'e1', { condition: 'score > 0.8' })],
      );

      const diff = computeGraphDiff(current, proposed);

      expect(diff.modifiedEdges).toHaveLength(1);
      expect(diff.modifiedEdges[0].before.condition).toBeNull();
      expect(diff.modifiedEdges[0].after.condition).toBe('score > 0.8');
    });

    it('detects modified edges when label changes', () => {
      const current = makeGraph([], [makeEdge('a', 'b', 'e1')]);
      const proposed = makeGraph([], [makeEdge('a', 'b', 'e1', { label: 'Yes' })]);

      const diff = computeGraphDiff(current, proposed);

      expect(diff.modifiedEdges).toHaveLength(1);
      expect(diff.modifiedEdges[0].after.label).toBe('Yes');
    });

    it('detects modified edges when from/to changes', () => {
      const current = makeGraph([], [makeEdge('a', 'b', 'e1')]);
      const proposed = makeGraph([], [{ id: 'e1', from: 'a', to: 'c', condition: null, label: null }]);

      const diff = computeGraphDiff(current, proposed);

      expect(diff.modifiedEdges).toHaveLength(1);
      expect(diff.modifiedEdges[0].before.to).toBe('b');
      expect(diff.modifiedEdges[0].after.to).toBe('c');
    });
  });

  describe('mixed changes', () => {
    it('detects concurrent node additions, removals, and modifications', () => {
      const current = makeGraph(
        [
          makeNode('keep', SOPNodeType.INFORMATION_GATHER),
          makeNode('remove', SOPNodeType.ASSESSMENT),
          makeNode('modify', SOPNodeType.DECISION),
        ],
        [makeEdge('keep', 'remove', 'e1'), makeEdge('remove', 'modify', 'e2')],
      );
      const proposed = makeGraph(
        [
          makeNode('keep', SOPNodeType.INFORMATION_GATHER),
          makeNode('modify', SOPNodeType.DECISION, { label: 'Changed' }),
          makeNode('added', SOPNodeType.CHECKPOINT),
        ],
        [makeEdge('keep', 'modify', 'e3')],
      );

      const diff = computeGraphDiff(current, proposed);

      expect(diff.addedNodes).toHaveLength(1);
      expect(diff.addedNodes[0].id).toBe('added');
      expect(diff.removedNodes).toHaveLength(1);
      expect(diff.removedNodes[0].id).toBe('remove');
      expect(diff.modifiedNodes).toHaveLength(1);
      expect(diff.modifiedNodes[0].before.id).toBe('modify');

      expect(diff.addedEdges).toHaveLength(1);
      expect(diff.addedEdges[0].id).toBe('e3');
      expect(diff.removedEdges).toHaveLength(2);
    });
  });

  describe('empty graphs', () => {
    it('returns empty diff when both graphs are empty', () => {
      const diff = computeGraphDiff(
        makeGraph([], []),
        makeGraph([], []),
      );

      expect(diff.addedNodes).toHaveLength(0);
      expect(diff.removedNodes).toHaveLength(0);
      expect(diff.modifiedNodes).toHaveLength(0);
      expect(diff.addedEdges).toHaveLength(0);
      expect(diff.removedEdges).toHaveLength(0);
      expect(diff.modifiedEdges).toHaveLength(0);
      expect(diff.summary).toBe('No changes');
    });

    it('detects all nodes and edges as added when current graph is empty', () => {
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER)],
        [makeEdge('a', 'b')],
      );
      const diff = computeGraphDiff(makeGraph([], []), proposed);

      expect(diff.addedNodes).toHaveLength(1);
      expect(diff.addedEdges).toHaveLength(1);
      expect(diff.removedNodes).toHaveLength(0);
      expect(diff.removedEdges).toHaveLength(0);
    });

    it('detects all nodes and edges as removed when proposed graph is empty', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.INFORMATION_GATHER)],
        [makeEdge('a', 'b')],
      );
      const diff = computeGraphDiff(current, makeGraph([], []));

      expect(diff.removedNodes).toHaveLength(1);
      expect(diff.removedEdges).toHaveLength(1);
      expect(diff.addedNodes).toHaveLength(0);
      expect(diff.addedEdges).toHaveLength(0);
    });
  });

  describe('summary', () => {
    it('returns "No changes" for identical graphs', () => {
      const graph = makeGraph([makeNode('a', SOPNodeType.DECISION)], []);
      const diff = computeGraphDiff(graph, graph);
      expect(diff.summary).toBe('No changes');
    });

    it('uses singular form for single additions', () => {
      const current = makeGraph([], []);
      const proposed = makeGraph([makeNode('a', SOPNodeType.DECISION)], []);
      const diff = computeGraphDiff(current, proposed);
      expect(diff.summary).toContain('Added 1 node');
      expect(diff.summary).not.toContain('nodes');
    });

    it('uses plural form for multiple additions', () => {
      const current = makeGraph([], []);
      const proposed = makeGraph(
        [makeNode('a', SOPNodeType.DECISION), makeNode('b', SOPNodeType.CHECKPOINT)],
        [],
      );
      const diff = computeGraphDiff(current, proposed);
      expect(diff.summary).toContain('Added 2 nodes');
    });

    it('joins multiple change types with commas', () => {
      const current = makeGraph(
        [makeNode('a', SOPNodeType.DECISION)],
        [makeEdge('a', 'b', 'e1')],
      );
      const proposed = makeGraph(
        [makeNode('b', SOPNodeType.CHECKPOINT)],
        [makeEdge('c', 'd', 'e2')],
      );
      const diff = computeGraphDiff(current, proposed);

      // Should contain multiple comma-separated parts
      const parts = diff.summary.split(', ');
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });

    it('includes edge changes in summary', () => {
      const current = makeGraph([], []);
      const proposed = makeGraph([], [makeEdge('a', 'b')]);
      const diff = computeGraphDiff(current, proposed);
      expect(diff.summary).toContain('Added 1 edge');
    });
  });
});
