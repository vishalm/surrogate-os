import type { SOPGraph, SOPNode, SOPEdge } from '@surrogate-os/shared';
import { SOPNodeType } from '@surrogate-os/shared';

export interface ExecutionState {
  sessionId: string;
  surrogateId: string;
  sopId: string;
  currentNodeId: string;
  visitedNodes: string[];
  decisions: ExecutionDecision[];
  status: ExecutionStatusType;
  startedAt: Date;
  context: Record<string, unknown>;
}

export type ExecutionStatusType =
  | 'RUNNING'
  | 'PAUSED'
  | 'AWAITING_INPUT'
  | 'AWAITING_ESCALATION'
  | 'COMPLETED'
  | 'ABORTED';

export interface ExecutionDecision {
  nodeId: string;
  edgeId: string;
  decision: string;
  confidence: number;
  timestamp: Date;
  input?: Record<string, unknown>;
}

export interface AvailableTransition {
  edgeId: string;
  label: string | null;
  condition: string | null;
  targetNodeId: string;
}

export interface ExecutionProgress {
  visited: number;
  total: number;
  percentage: number;
}

export interface PathValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Pure SOP execution engine — no I/O, stateless transforms.
 * Given an SOP graph and current state, computes next state.
 */
export class SOPExecutor {
  /**
   * Initialize execution at the first node with no incoming edges (start node).
   */
  static start(
    sopGraph: SOPGraph,
    sessionId: string,
    surrogateId: string,
    sopId: string,
  ): ExecutionState {
    const startNode = SOPExecutor.findStartNode(sopGraph);
    if (!startNode) {
      throw new Error('SOP graph has no start node (node with no incoming edges)');
    }

    const status = SOPExecutor.determineNodeStatus(startNode, sopGraph);

    return {
      sessionId,
      surrogateId,
      sopId,
      currentNodeId: startNode.id,
      visitedNodes: [startNode.id],
      decisions: [],
      status,
      startedAt: new Date(),
      context: {},
    };
  }

  /**
   * Advance to next node based on a chosen edge/decision.
   */
  static advance(
    state: ExecutionState,
    sopGraph: SOPGraph,
    decision: {
      edgeId: string;
      decision: string;
      confidence: number;
      input?: Record<string, unknown>;
    },
  ): ExecutionState {
    if (state.status === 'COMPLETED' || state.status === 'ABORTED') {
      throw new Error(`Cannot advance execution in ${state.status} status`);
    }

    // Validate that the edge exists and originates from the current node
    const edge = sopGraph.edges.find((e) => e.id === decision.edgeId);
    if (!edge) {
      throw new Error(`Edge ${decision.edgeId} not found in SOP graph`);
    }
    if (edge.from !== state.currentNodeId) {
      throw new Error(
        `Edge ${decision.edgeId} does not originate from current node ${state.currentNodeId}`,
      );
    }

    // Validate target node exists
    const targetNode = sopGraph.nodes.find((n) => n.id === edge.to);
    if (!targetNode) {
      throw new Error(`Target node ${edge.to} not found in SOP graph`);
    }

    const newDecision: ExecutionDecision = {
      nodeId: state.currentNodeId,
      edgeId: decision.edgeId,
      decision: decision.decision,
      confidence: decision.confidence,
      timestamp: new Date(),
      input: decision.input,
    };

    const visitedNodes = [...state.visitedNodes, targetNode.id];
    const decisions = [...state.decisions, newDecision];

    // Determine if we've reached a terminal node (no outgoing edges)
    const outgoingEdges = sopGraph.edges.filter((e) => e.from === targetNode.id);
    const isTerminal = outgoingEdges.length === 0;

    const status: ExecutionStatusType = isTerminal
      ? 'COMPLETED'
      : SOPExecutor.determineNodeStatus(targetNode, sopGraph);

    const context = decision.input
      ? { ...state.context, ...decision.input }
      : state.context;

    return {
      ...state,
      currentNodeId: targetNode.id,
      visitedNodes,
      decisions,
      status,
      context,
    };
  }

  /**
   * Get available transitions (outgoing edges) from current node.
   */
  static getAvailableTransitions(
    state: ExecutionState,
    sopGraph: SOPGraph,
  ): AvailableTransition[] {
    return sopGraph.edges
      .filter((e) => e.from === state.currentNodeId)
      .map((edge) => ({
        edgeId: edge.id,
        label: edge.label,
        condition: edge.condition,
        targetNodeId: edge.to,
      }));
  }

  /**
   * Check if current node is an escalation node.
   */
  static requiresEscalation(state: ExecutionState, sopGraph: SOPGraph): boolean {
    const currentNode = sopGraph.nodes.find((n) => n.id === state.currentNodeId);
    return currentNode?.type === SOPNodeType.ESCALATION;
  }

  /**
   * Check if current node is a checkpoint node.
   */
  static isCheckpoint(state: ExecutionState, sopGraph: SOPGraph): boolean {
    const currentNode = sopGraph.nodes.find((n) => n.id === state.currentNodeId);
    return currentNode?.type === SOPNodeType.CHECKPOINT;
  }

  /**
   * Compute execution progress.
   */
  static getProgress(state: ExecutionState, sopGraph: SOPGraph): ExecutionProgress {
    const total = sopGraph.nodes.length;
    const visited = new Set(state.visitedNodes).size;
    const percentage = total > 0 ? Math.round((visited / total) * 100) : 0;
    return { visited, total, percentage };
  }

  /**
   * Validate that the execution path is consistent with the graph.
   */
  static validatePath(state: ExecutionState, sopGraph: SOPGraph): PathValidation {
    const errors: string[] = [];
    const nodeIds = new Set(sopGraph.nodes.map((n) => n.id));
    const edgeMap = new Map(sopGraph.edges.map((e) => [e.id, e]));

    // Validate all visited nodes exist
    for (const nodeId of state.visitedNodes) {
      if (!nodeIds.has(nodeId)) {
        errors.push(`Visited node ${nodeId} does not exist in SOP graph`);
      }
    }

    // Validate current node exists
    if (!nodeIds.has(state.currentNodeId)) {
      errors.push(`Current node ${state.currentNodeId} does not exist in SOP graph`);
    }

    // Validate decision edges are consistent
    for (const decision of state.decisions) {
      const edge = edgeMap.get(decision.edgeId);
      if (!edge) {
        errors.push(`Decision edge ${decision.edgeId} does not exist in SOP graph`);
        continue;
      }
      if (edge.from !== decision.nodeId) {
        errors.push(
          `Decision edge ${decision.edgeId} does not originate from node ${decision.nodeId}`,
        );
      }
    }

    // Validate path continuity
    for (let i = 0; i < state.decisions.length; i++) {
      const decision = state.decisions[i];
      const edge = edgeMap.get(decision.edgeId);
      if (!edge) continue;

      // The node after this decision should be the edge's target
      const nextVisitedIndex = i + 1; // +1 because visitedNodes[0] is the start node
      if (nextVisitedIndex < state.visitedNodes.length) {
        if (state.visitedNodes[nextVisitedIndex] !== edge.to) {
          errors.push(
            `Path discontinuity: decision ${i} edge targets ${edge.to} but next visited node is ${state.visitedNodes[nextVisitedIndex]}`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Find the start node — a node with no incoming edges.
   */
  private static findStartNode(sopGraph: SOPGraph): SOPNode | null {
    const targetIds = new Set(sopGraph.edges.map((e) => e.to));
    const startNodes = sopGraph.nodes.filter((n) => !targetIds.has(n.id));
    return startNodes[0] ?? null;
  }

  /**
   * Determine status based on node type.
   */
  private static determineNodeStatus(
    node: SOPNode,
    _sopGraph: SOPGraph,
  ): ExecutionStatusType {
    switch (node.type) {
      case SOPNodeType.ESCALATION:
        return 'AWAITING_ESCALATION';
      case SOPNodeType.DECISION:
      case SOPNodeType.INFORMATION_GATHER:
        return 'AWAITING_INPUT';
      default:
        return 'RUNNING';
    }
  }
}
