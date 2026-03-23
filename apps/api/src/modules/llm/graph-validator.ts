import type { SOPGraph } from '@surrogate-os/shared';
import { SOPNodeType } from '@surrogate-os/shared';

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a SOPGraph for structural correctness:
 * - All edge from/to reference valid node IDs
 * - Graph is a DAG (no cycles)
 * - Has at least one ESCALATION node
 * - Has at least one CHECKPOINT node
 * - No orphan nodes (except the start node)
 * - Node IDs are unique
 */
export function validateSOPGraph(graph: SOPGraph): GraphValidationResult {
  const errors: string[] = [];

  if (!graph.nodes || graph.nodes.length === 0) {
    return { valid: false, errors: ['Graph must have at least one node'] };
  }

  // Check unique node IDs
  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }
    nodeIds.add(node.id);
  }

  // Check edges reference valid nodes
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references non-existent source node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references non-existent target node: ${edge.to}`);
    }
  }

  // Check for required node types
  const nodeTypes = new Set(graph.nodes.map((n) => n.type));
  if (!nodeTypes.has(SOPNodeType.ESCALATION)) {
    errors.push('Graph must contain at least one ESCALATION node');
  }
  if (!nodeTypes.has(SOPNodeType.CHECKPOINT)) {
    errors.push('Graph must contain at least one CHECKPOINT node');
  }

  // Check for cycles (DFS-based)
  if (errors.length === 0) {
    const cycleError = detectCycle(graph);
    if (cycleError) {
      errors.push(cycleError);
    }
  }

  // Check for orphan nodes (nodes with no incoming or outgoing edges, except if only 1 node)
  if (graph.nodes.length > 1 && errors.length === 0) {
    const hasIncoming = new Set<string>();
    const hasOutgoing = new Set<string>();
    for (const edge of graph.edges) {
      hasOutgoing.add(edge.from);
      hasIncoming.add(edge.to);
    }

    for (const node of graph.nodes) {
      if (!hasIncoming.has(node.id) && !hasOutgoing.has(node.id)) {
        errors.push(`Orphan node with no connections: ${node.id}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function detectCycle(graph: SOPGraph): string | null {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push(edge.to);
  }

  const WHITE = 0; // unvisited
  const GRAY = 1; // in current path
  const BLACK = 2; // fully processed

  const color = new Map<string, number>();
  for (const node of graph.nodes) {
    color.set(node.id, WHITE);
  }

  for (const node of graph.nodes) {
    if (color.get(node.id) === WHITE) {
      if (dfsHasCycle(node.id, adjacency, color)) {
        return 'Graph contains a cycle — SOPs must be directed acyclic graphs (DAGs)';
      }
    }
  }

  return null;
}

function dfsHasCycle(
  nodeId: string,
  adjacency: Map<string, string[]>,
  color: Map<string, number>,
): boolean {
  color.set(nodeId, 1); // GRAY

  for (const neighbor of adjacency.get(nodeId) ?? []) {
    if (color.get(neighbor) === 1) return true; // back edge → cycle
    if (color.get(neighbor) === 0 && dfsHasCycle(neighbor, adjacency, color)) return true;
  }

  color.set(nodeId, 2); // BLACK
  return false;
}

/**
 * Compute a heuristic confidence score for a generated SOP graph.
 * Based on structural completeness, not LLM self-reported confidence.
 */
export function computeGraphConfidence(graph: SOPGraph, validation: GraphValidationResult): number {
  let score = 0.5;

  if (validation.valid) score += 0.1;

  const nodeTypes = new Set(graph.nodes.map((n) => n.type));
  if (nodeTypes.has(SOPNodeType.ESCALATION)) score += 0.08;
  if (nodeTypes.has(SOPNodeType.CHECKPOINT)) score += 0.08;
  if (nodeTypes.has(SOPNodeType.DECISION)) {
    // Check if decision nodes have multiple outgoing edges
    const decisionNodes = graph.nodes.filter((n) => n.type === SOPNodeType.DECISION);
    const hasMultipleEdges = decisionNodes.some((dn) => {
      const outgoing = graph.edges.filter((e) => e.from === dn.id);
      return outgoing.length >= 2;
    });
    if (hasMultipleEdges) score += 0.1;
  }

  // Reward non-trivial graphs (5+ nodes)
  if (graph.nodes.length >= 5) score += 0.07;
  if (graph.nodes.length >= 10) score += 0.07;

  return Math.min(Math.max(score, 0), 1);
}
