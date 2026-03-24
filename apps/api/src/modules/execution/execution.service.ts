import type { PrismaClient } from '@prisma/client';
import type { PaginatedResponse, SOPGraph } from '@surrogate-os/shared';
import { AuditAction } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { SOPExecutor, type ExecutionState, type ExecutionDecision } from './sop-executor.js';

interface ExecutionRow {
  id: string;
  session_id: string | null;
  surrogate_id: string;
  sop_id: string;
  current_node_id: string;
  visited_nodes: string[];
  decisions: ExecutionDecision[];
  status: string;
  context: Record<string, unknown>;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
}

interface CountRow {
  count: bigint;
}

interface SOPRow {
  id: string;
  surrogate_id: string;
  graph: SOPGraph;
  title: string;
  status: string;
}

interface SessionRow {
  id: string;
}

function mapExecutionRow(row: ExecutionRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    surrogateId: row.surrogate_id,
    sopId: row.sop_id,
    currentNodeId: row.current_node_id,
    visitedNodes: row.visited_nodes,
    decisions: row.decisions,
    status: row.status,
    context: row.context,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export class ExecutionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async startExecution(
    tenant: TenantContext,
    surrogateId: string,
    sopId: string,
    userId: string,
  ) {
    // Validate surrogate exists
    const surrogates = await this.tenantManager.executeInTenant<{ id: string }[]>(
      tenant.orgSlug,
      `SELECT id FROM surrogates WHERE id = $1::uuid`,
      [surrogateId],
    );
    if (surrogates.length === 0) {
      throw new NotFoundError('Surrogate not found');
    }

    // Validate SOP exists and get its graph
    const sops = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `SELECT id, surrogate_id, graph, title, status FROM sops WHERE id = $1::uuid`,
      [sopId],
    );
    if (sops.length === 0) {
      throw new NotFoundError('SOP not found');
    }
    const sop = sops[0];
    const sopGraph = sop.graph as SOPGraph;

    if (!sopGraph.nodes || sopGraph.nodes.length === 0) {
      throw new ValidationError('SOP graph has no nodes');
    }

    // Create a session for this execution
    const sessions = await this.tenantManager.executeInTenant<SessionRow[]>(
      tenant.orgSlug,
      `INSERT INTO sessions (surrogate_id, status, metadata)
       VALUES ($1::uuid, 'ACTIVE', $2::jsonb)
       RETURNING id`,
      [surrogateId, JSON.stringify({ executionSopId: sopId, executionSopTitle: sop.title })],
    );
    const sessionId = sessions[0].id;

    // Initialize execution state
    const state = SOPExecutor.start(sopGraph, sessionId, surrogateId, sopId);

    // Persist execution
    const rows = await this.tenantManager.executeInTenant<ExecutionRow[]>(
      tenant.orgSlug,
      `INSERT INTO executions (session_id, surrogate_id, sop_id, current_node_id, visited_nodes, decisions, status, context, started_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9)
       RETURNING *`,
      [
        sessionId,
        surrogateId,
        sopId,
        state.currentNodeId,
        JSON.stringify(state.visitedNodes),
        JSON.stringify(state.decisions),
        state.status,
        JSON.stringify(state.context),
        state.startedAt,
      ],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId,
      userId,
      action: AuditAction.SESSION_STARTED,
      details: { executionId: rows[0].id, sopId, sopTitle: sop.title },
    });

    return mapExecutionRow(rows[0]);
  }

  async advanceExecution(
    tenant: TenantContext,
    executionId: string,
    decision: {
      edgeId: string;
      decision: string;
      confidence: number;
      input?: Record<string, unknown>;
    },
    userId: string,
  ) {
    const execution = await this.getExecutionRow(tenant, executionId);

    // Get SOP graph
    const sopGraph = await this.getSOPGraph(tenant, execution.sop_id);

    // Reconstruct state
    const state: ExecutionState = {
      sessionId: execution.session_id ?? '',
      surrogateId: execution.surrogate_id,
      sopId: execution.sop_id,
      currentNodeId: execution.current_node_id,
      visitedNodes: execution.visited_nodes,
      decisions: execution.decisions,
      status: execution.status as ExecutionState['status'],
      startedAt: execution.started_at,
      context: execution.context,
    };

    // Advance
    const newState = SOPExecutor.advance(state, sopGraph, decision);

    // Persist
    const completedAt = newState.status === 'COMPLETED' ? new Date() : null;
    const rows = await this.tenantManager.executeInTenant<ExecutionRow[]>(
      tenant.orgSlug,
      `UPDATE executions
       SET current_node_id = $1,
           visited_nodes = $2::jsonb,
           decisions = $3::jsonb,
           status = $4,
           context = $5::jsonb,
           completed_at = $6
       WHERE id = $7::uuid
       RETURNING *`,
      [
        newState.currentNodeId,
        JSON.stringify(newState.visitedNodes),
        JSON.stringify(newState.decisions),
        newState.status,
        JSON.stringify(newState.context),
        completedAt,
        executionId,
      ],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: execution.surrogate_id,
      userId,
      action: AuditAction.DECISION_MADE,
      details: {
        executionId,
        nodeId: execution.current_node_id,
        edgeId: decision.edgeId,
        decision: decision.decision,
        confidence: decision.confidence,
        newNodeId: newState.currentNodeId,
      },
    });

    // If completed, also complete the session
    if (newState.status === 'COMPLETED' && execution.session_id) {
      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `UPDATE sessions SET status = 'COMPLETED', ended_at = NOW() WHERE id = $1::uuid`,
        [execution.session_id],
      );

      await createAuditEntry(this.tenantManager, tenant.orgSlug, {
        surrogateId: execution.surrogate_id,
        userId,
        action: AuditAction.SESSION_COMPLETED,
        details: { executionId, sessionId: execution.session_id },
      });
    }

    return mapExecutionRow(rows[0]);
  }

  async pauseExecution(tenant: TenantContext, executionId: string, userId: string) {
    const execution = await this.getExecutionRow(tenant, executionId);

    if (execution.status === 'COMPLETED' || execution.status === 'ABORTED') {
      throw new ValidationError(`Cannot pause execution in ${execution.status} status`);
    }
    if (execution.status === 'PAUSED') {
      throw new ValidationError('Execution is already paused');
    }

    const rows = await this.tenantManager.executeInTenant<ExecutionRow[]>(
      tenant.orgSlug,
      `UPDATE executions SET status = 'PAUSED' WHERE id = $1::uuid RETURNING *`,
      [executionId],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: execution.surrogate_id,
      userId,
      action: AuditAction.DECISION_MADE,
      details: { executionId, action: 'PAUSED' },
    });

    return mapExecutionRow(rows[0]);
  }

  async resumeExecution(tenant: TenantContext, executionId: string, userId: string) {
    const execution = await this.getExecutionRow(tenant, executionId);

    if (execution.status !== 'PAUSED') {
      throw new ValidationError(`Cannot resume execution in ${execution.status} status`);
    }

    // Determine what status to resume to based on current node
    const sopGraph = await this.getSOPGraph(tenant, execution.sop_id);
    const currentNode = sopGraph.nodes.find((n) => n.id === execution.current_node_id);
    let resumeStatus = 'RUNNING';
    if (currentNode) {
      const state = { currentNodeId: currentNode.id } as ExecutionState;
      if (SOPExecutor.requiresEscalation(state, sopGraph)) {
        resumeStatus = 'AWAITING_ESCALATION';
      } else if (SOPExecutor.isCheckpoint(state, sopGraph)) {
        resumeStatus = 'AWAITING_INPUT';
      } else {
        const transitions = SOPExecutor.getAvailableTransitions(
          { ...state, currentNodeId: currentNode.id } as ExecutionState,
          sopGraph,
        );
        if (transitions.length > 1) {
          resumeStatus = 'AWAITING_INPUT';
        }
      }
    }

    const rows = await this.tenantManager.executeInTenant<ExecutionRow[]>(
      tenant.orgSlug,
      `UPDATE executions SET status = $1 WHERE id = $2::uuid RETURNING *`,
      [resumeStatus, executionId],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: execution.surrogate_id,
      userId,
      action: AuditAction.DECISION_MADE,
      details: { executionId, action: 'RESUMED' },
    });

    return mapExecutionRow(rows[0]);
  }

  async abortExecution(
    tenant: TenantContext,
    executionId: string,
    reason: string,
    userId: string,
  ) {
    const execution = await this.getExecutionRow(tenant, executionId);

    if (execution.status === 'COMPLETED' || execution.status === 'ABORTED') {
      throw new ValidationError(`Cannot abort execution in ${execution.status} status`);
    }

    const rows = await this.tenantManager.executeInTenant<ExecutionRow[]>(
      tenant.orgSlug,
      `UPDATE executions SET status = 'ABORTED', completed_at = NOW(), context = context || $1::jsonb
       WHERE id = $2::uuid RETURNING *`,
      [JSON.stringify({ abortReason: reason }), executionId],
    );

    // Also end the session
    if (execution.session_id) {
      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `UPDATE sessions SET status = 'ABANDONED', ended_at = NOW() WHERE id = $1::uuid`,
        [execution.session_id],
      );
    }

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: execution.surrogate_id,
      userId,
      action: AuditAction.DECISION_MADE,
      details: { executionId, action: 'ABORTED', reason },
    });

    return mapExecutionRow(rows[0]);
  }

  async escalate(
    tenant: TenantContext,
    executionId: string,
    reason: string,
    userId: string,
  ) {
    const execution = await this.getExecutionRow(tenant, executionId);

    if (execution.status === 'COMPLETED' || execution.status === 'ABORTED') {
      throw new ValidationError(`Cannot escalate execution in ${execution.status} status`);
    }

    const rows = await this.tenantManager.executeInTenant<ExecutionRow[]>(
      tenant.orgSlug,
      `UPDATE executions SET status = 'AWAITING_ESCALATION', context = context || $1::jsonb
       WHERE id = $2::uuid RETURNING *`,
      [JSON.stringify({ escalationReason: reason, escalatedAt: new Date().toISOString() }), executionId],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: execution.surrogate_id,
      userId,
      action: AuditAction.ESCALATION_TRIGGERED,
      details: { executionId, reason, nodeId: execution.current_node_id },
    });

    return mapExecutionRow(rows[0]);
  }

  async getExecution(tenant: TenantContext, executionId: string) {
    const execution = await this.getExecutionRow(tenant, executionId);
    return mapExecutionRow(execution);
  }

  async listExecutions(
    tenant: TenantContext,
    pagination: PaginationParams,
    filters?: { status?: string; surrogateId?: string },
  ): Promise<PaginatedResponse<ReturnType<typeof mapExecutionRow>>> {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters?.surrogateId) {
      whereClauses.push(`surrogate_id = $${paramIndex++}::uuid`);
      params.push(filters.surrogateId);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM executions ${where}`,
      params,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<ExecutionRow[]>(
      tenant.orgSlug,
      `SELECT * FROM executions ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapExecutionRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getExecutionTimeline(tenant: TenantContext, executionId: string) {
    const execution = await this.getExecutionRow(tenant, executionId);
    const sopGraph = await this.getSOPGraph(tenant, execution.sop_id);

    const nodeMap = new Map(sopGraph.nodes.map((n) => [n.id, n]));
    const edgeMap = new Map(sopGraph.edges.map((e) => [e.id, e]));

    const timeline = execution.decisions.map((d) => {
      const node = nodeMap.get(d.nodeId);
      const edge = edgeMap.get(d.edgeId);
      const targetNode = edge ? nodeMap.get(edge.to) : null;

      return {
        nodeId: d.nodeId,
        nodeLabel: node?.label ?? d.nodeId,
        nodeType: node?.type ?? 'UNKNOWN',
        edgeId: d.edgeId,
        edgeLabel: edge?.label ?? edge?.condition ?? null,
        targetNodeId: edge?.to ?? null,
        targetNodeLabel: targetNode?.label ?? null,
        decision: d.decision,
        confidence: d.confidence,
        timestamp: d.timestamp,
        input: d.input,
      };
    });

    return {
      executionId: execution.id,
      sopId: execution.sop_id,
      surrogateId: execution.surrogate_id,
      status: execution.status,
      startedAt: execution.started_at,
      completedAt: execution.completed_at,
      timeline,
    };
  }

  async getTransitions(tenant: TenantContext, executionId: string) {
    const execution = await this.getExecutionRow(tenant, executionId);
    const sopGraph = await this.getSOPGraph(tenant, execution.sop_id);

    const state: ExecutionState = {
      sessionId: execution.session_id ?? '',
      surrogateId: execution.surrogate_id,
      sopId: execution.sop_id,
      currentNodeId: execution.current_node_id,
      visitedNodes: execution.visited_nodes,
      decisions: execution.decisions,
      status: execution.status as ExecutionState['status'],
      startedAt: execution.started_at,
      context: execution.context,
    };

    const transitions = SOPExecutor.getAvailableTransitions(state, sopGraph);
    const progress = SOPExecutor.getProgress(state, sopGraph);
    const requiresEscalation = SOPExecutor.requiresEscalation(state, sopGraph);
    const isCheckpoint = SOPExecutor.isCheckpoint(state, sopGraph);

    // Enrich transitions with target node info
    const nodeMap = new Map(sopGraph.nodes.map((n) => [n.id, n]));
    const enrichedTransitions = transitions.map((t) => {
      const targetNode = nodeMap.get(t.targetNodeId);
      return {
        ...t,
        targetNodeLabel: targetNode?.label ?? null,
        targetNodeType: targetNode?.type ?? null,
      };
    });

    return {
      transitions: enrichedTransitions,
      progress,
      requiresEscalation,
      isCheckpoint,
      currentNodeId: execution.current_node_id,
      currentNodeLabel: nodeMap.get(execution.current_node_id)?.label ?? null,
      currentNodeType: nodeMap.get(execution.current_node_id)?.type ?? null,
    };
  }

  // ---- Private helpers ----

  private async getExecutionRow(tenant: TenantContext, executionId: string): Promise<ExecutionRow> {
    const rows = await this.tenantManager.executeInTenant<ExecutionRow[]>(
      tenant.orgSlug,
      `SELECT * FROM executions WHERE id = $1::uuid`,
      [executionId],
    );
    if (rows.length === 0) {
      throw new NotFoundError('Execution not found');
    }
    return rows[0];
  }

  private async getSOPGraph(tenant: TenantContext, sopId: string): Promise<SOPGraph> {
    const sops = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `SELECT id, surrogate_id, graph, title, status FROM sops WHERE id = $1::uuid`,
      [sopId],
    );
    if (sops.length === 0) {
      throw new NotFoundError('SOP not found');
    }
    return sops[0].graph as SOPGraph;
  }
}
