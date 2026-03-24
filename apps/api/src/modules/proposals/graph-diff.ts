import type { SOPGraph, SOPNode, SOPEdge } from '@surrogate-os/shared';

export interface GraphDiff {
  addedNodes: SOPNode[];
  removedNodes: SOPNode[];
  modifiedNodes: { before: SOPNode; after: SOPNode }[];
  addedEdges: SOPEdge[];
  removedEdges: SOPEdge[];
  modifiedEdges: { before: SOPEdge; after: SOPEdge }[];
  summary: string;
}

/**
 * Compare two SOP graphs and return a structured diff.
 * Nodes/edges are matched by their `id` field.
 * A node is "modified" if it has the same ID but different label, type, or description.
 * An edge is "modified" if it has the same ID but different from, to, condition, or label.
 */
export function computeGraphDiff(
  currentGraph: SOPGraph,
  proposedGraph: SOPGraph,
): GraphDiff {
  // Index nodes by ID
  const currentNodeMap = new Map<string, SOPNode>();
  for (const node of currentGraph.nodes) {
    currentNodeMap.set(node.id, node);
  }

  const proposedNodeMap = new Map<string, SOPNode>();
  for (const node of proposedGraph.nodes) {
    proposedNodeMap.set(node.id, node);
  }

  // Compute node diffs
  const addedNodes: SOPNode[] = [];
  const removedNodes: SOPNode[] = [];
  const modifiedNodes: { before: SOPNode; after: SOPNode }[] = [];

  for (const [id, proposedNode] of proposedNodeMap) {
    const currentNode = currentNodeMap.get(id);
    if (!currentNode) {
      addedNodes.push(proposedNode);
    } else if (isNodeModified(currentNode, proposedNode)) {
      modifiedNodes.push({ before: currentNode, after: proposedNode });
    }
  }

  for (const [id, currentNode] of currentNodeMap) {
    if (!proposedNodeMap.has(id)) {
      removedNodes.push(currentNode);
    }
  }

  // Index edges by ID
  const currentEdgeMap = new Map<string, SOPEdge>();
  for (const edge of currentGraph.edges) {
    currentEdgeMap.set(edge.id, edge);
  }

  const proposedEdgeMap = new Map<string, SOPEdge>();
  for (const edge of proposedGraph.edges) {
    proposedEdgeMap.set(edge.id, edge);
  }

  // Compute edge diffs
  const addedEdges: SOPEdge[] = [];
  const removedEdges: SOPEdge[] = [];
  const modifiedEdges: { before: SOPEdge; after: SOPEdge }[] = [];

  for (const [id, proposedEdge] of proposedEdgeMap) {
    const currentEdge = currentEdgeMap.get(id);
    if (!currentEdge) {
      addedEdges.push(proposedEdge);
    } else if (isEdgeModified(currentEdge, proposedEdge)) {
      modifiedEdges.push({ before: currentEdge, after: proposedEdge });
    }
  }

  for (const [id, currentEdge] of currentEdgeMap) {
    if (!proposedEdgeMap.has(id)) {
      removedEdges.push(currentEdge);
    }
  }

  // Build summary
  const parts: string[] = [];
  if (addedNodes.length > 0) parts.push(`Added ${addedNodes.length} node${addedNodes.length > 1 ? 's' : ''}`);
  if (removedNodes.length > 0) parts.push(`Removed ${removedNodes.length} node${removedNodes.length > 1 ? 's' : ''}`);
  if (modifiedNodes.length > 0) parts.push(`Modified ${modifiedNodes.length} node${modifiedNodes.length > 1 ? 's' : ''}`);
  if (addedEdges.length > 0) parts.push(`Added ${addedEdges.length} edge${addedEdges.length > 1 ? 's' : ''}`);
  if (removedEdges.length > 0) parts.push(`Removed ${removedEdges.length} edge${removedEdges.length > 1 ? 's' : ''}`);
  if (modifiedEdges.length > 0) parts.push(`Modified ${modifiedEdges.length} edge${modifiedEdges.length > 1 ? 's' : ''}`);

  const summary = parts.length > 0 ? parts.join(', ') : 'No changes';

  return {
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedEdges,
    removedEdges,
    modifiedEdges,
    summary,
  };
}

function isNodeModified(current: SOPNode, proposed: SOPNode): boolean {
  return (
    current.label !== proposed.label ||
    current.type !== proposed.type ||
    current.description !== proposed.description
  );
}

function isEdgeModified(current: SOPEdge, proposed: SOPEdge): boolean {
  return (
    current.from !== proposed.from ||
    current.to !== proposed.to ||
    current.condition !== proposed.condition ||
    current.label !== proposed.label
  );
}
