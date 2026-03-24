import type { PrismaClient } from '@prisma/client';
import { AuditAction, SessionStatus } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { getLLMSettings, callLLM } from '../../lib/llm-provider.js';
import { OrgService } from '../orgs/orgs.service.js';
import {
  buildDebriefSystemPrompt,
  buildDebriefGenerationPrompt,
  buildDebriefTool,
} from './prompts.js';

// ── Row types ────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  surrogate_id: string;
  status: string;
  metadata: Record<string, unknown>;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}

interface DecisionOutcomeRow {
  id: string;
  session_id: string;
  surrogate_id: string;
  sop_node_id: string | null;
  decision: string;
  outcome: string | null;
  confidence: number | null;
  context: Record<string, unknown>;
  created_at: Date;
}

interface DebriefRow {
  id: string;
  session_id: string;
  surrogate_id: string;
  summary: string;
  decisions: Record<string, unknown>[];
  escalations: Record<string, unknown>[];
  edge_cases: Record<string, unknown>[];
  recommendations: Record<string, unknown>[];
  confidence: number | null;
  generated_at: Date;
}

interface SurrogateRow {
  id: string;
  role_title: string;
  domain: string;
}

interface CountRow {
  count: bigint;
}

// ── Row mappers ──────────────────────────────────────────────────────

function mapSessionRow(row: SessionRow) {
  return {
    id: row.id,
    surrogateId: row.surrogate_id,
    status: row.status,
    metadata: row.metadata,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

function mapDecisionRow(row: DecisionOutcomeRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    surrogateId: row.surrogate_id,
    sopNodeId: row.sop_node_id,
    decision: row.decision,
    outcome: row.outcome,
    confidence: row.confidence,
    context: row.context,
    createdAt: row.created_at,
  };
}

function mapDebriefRow(row: DebriefRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    surrogateId: row.surrogate_id,
    summary: row.summary,
    decisions: row.decisions,
    escalations: row.escalations,
    edgeCases: row.edge_cases,
    recommendations: row.recommendations,
    confidence: row.confidence,
    generatedAt: row.generated_at,
  };
}

// ── LLM result type ──────────────────────────────────────────────────

interface DebriefLLMResult {
  summary: string;
  decisions: { description: string; outcome: string; wasCorrect: boolean; improvement: string }[];
  escalations: { reason: string; context: string }[];
  edgeCases: { description: string; suggestedHandling: string }[];
  recommendations: { title: string; description: string; priority: string; sopImpact: string }[];
}

// ── Debrief Service ──────────────────────────────────────────────────

export class DebriefService {
  private orgService: OrgService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {
    this.orgService = new OrgService(prisma);
  }

  // ── Session methods ──────────────────────────────────────────────

  async startSession(
    tenant: TenantContext,
    surrogateId: string,
    metadata: Record<string, unknown> | undefined,
    userId: string,
  ) {
    const rows = await this.tenantManager.executeInTenant<SessionRow[]>(
      tenant.orgSlug,
      `INSERT INTO sessions (surrogate_id, status, metadata, started_at)
       VALUES ($1::uuid, $2, $3::jsonb, NOW())
       RETURNING *`,
      [surrogateId, SessionStatus.ACTIVE, JSON.stringify(metadata ?? {})],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId,
      userId,
      action: AuditAction.SESSION_STARTED,
      details: { sessionId: rows[0].id },
    });

    return mapSessionRow(rows[0]);
  }

  async recordDecision(
    tenant: TenantContext,
    sessionId: string,
    input: {
      surrogateId: string;
      sopNodeId?: string;
      decision: string;
      outcome?: string;
      confidence?: number;
      context?: Record<string, unknown>;
    },
    userId: string,
  ) {
    // Verify session exists and is active
    const session = await this.getSession(tenant, sessionId);
    if (session.status !== SessionStatus.ACTIVE) {
      throw new ValidationError('Cannot record decisions on a non-active session');
    }

    const rows = await this.tenantManager.executeInTenant<DecisionOutcomeRow[]>(
      tenant.orgSlug,
      `INSERT INTO decision_outcomes (session_id, surrogate_id, sop_node_id, decision, outcome, confidence, context)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [
        sessionId,
        input.surrogateId,
        input.sopNodeId ?? null,
        input.decision,
        input.outcome ?? null,
        input.confidence ?? null,
        JSON.stringify(input.context ?? {}),
      ],
    );

    return mapDecisionRow(rows[0]);
  }

  async completeSession(
    tenant: TenantContext,
    sessionId: string,
    userId: string,
  ) {
    const session = await this.getSession(tenant, sessionId);
    if (session.status !== SessionStatus.ACTIVE) {
      throw new ValidationError('Only active sessions can be completed');
    }

    const rows = await this.tenantManager.executeInTenant<SessionRow[]>(
      tenant.orgSlug,
      `UPDATE sessions SET status = $1, ended_at = NOW() WHERE id = $2::uuid RETURNING *`,
      [SessionStatus.COMPLETED, sessionId],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: session.surrogateId,
      userId,
      action: AuditAction.SESSION_COMPLETED,
      details: { sessionId },
    });

    return mapSessionRow(rows[0]);
  }

  async listSessions(
    tenant: TenantContext,
    pagination: PaginationParams,
    filters?: { surrogateId?: string; status?: string },
  ) {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.surrogateId) {
      whereClauses.push(`surrogate_id = $${paramIndex++}::uuid`);
      params.push(filters.surrogateId);
    }
    if (filters?.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM sessions ${where}`,
      params,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<SessionRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sessions ${where}
       ORDER BY started_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapSessionRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getSession(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<SessionRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sessions WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Session not found');
    }

    return mapSessionRow(rows[0]);
  }

  // ── Debrief methods ──────────────────────────────────────────────

  async generateDebrief(
    tenant: TenantContext,
    sessionId: string,
    userId: string,
  ) {
    // 1. Fetch session
    const session = await this.getSession(tenant, sessionId);
    if (session.status !== SessionStatus.COMPLETED) {
      throw new ValidationError('Session must be completed before generating a debrief');
    }

    // Check if debrief already exists
    const existingDebrief = await this.tenantManager.executeInTenant<DebriefRow[]>(
      tenant.orgSlug,
      `SELECT * FROM debriefs WHERE session_id = $1::uuid`,
      [sessionId],
    );
    if (existingDebrief.length > 0) {
      throw new ValidationError('A debrief has already been generated for this session');
    }

    // 2. Fetch decision outcomes
    const decisions = await this.tenantManager.executeInTenant<DecisionOutcomeRow[]>(
      tenant.orgSlug,
      `SELECT * FROM decision_outcomes WHERE session_id = $1::uuid ORDER BY created_at ASC`,
      [sessionId],
    );

    // 3. Optionally fetch surrogate info for context
    let surrogateRoleTitle: string | undefined;
    let surrogateDomain: string | undefined;
    try {
      const surrogateRows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
        tenant.orgSlug,
        `SELECT id, role_title, domain FROM surrogates WHERE id = $1::uuid`,
        [session.surrogateId],
      );
      if (surrogateRows.length > 0) {
        surrogateRoleTitle = surrogateRows[0].role_title;
        surrogateDomain = surrogateRows[0].domain;
      }
    } catch {
      // Non-critical — proceed without surrogate details
    }

    // 4. Build LLM prompts
    const systemPrompt = buildDebriefSystemPrompt();
    const userPrompt = buildDebriefGenerationPrompt({
      sessionId,
      surrogateId: session.surrogateId,
      surrogateRoleTitle,
      surrogateDomain,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      metadata: session.metadata,
      decisions: decisions.map((d) => ({
        decision: d.decision,
        outcome: d.outcome,
        confidence: d.confidence,
        sopNodeId: d.sop_node_id,
        context: d.context,
        createdAt: d.created_at.toISOString(),
      })),
    });

    // 5. Resolve LLM settings & call LLM
    const llmSettings = await getLLMSettings(this.orgService, tenant.orgId);
    const tool = buildDebriefTool();

    const result = await callLLM<DebriefLLMResult>(llmSettings, systemPrompt, userPrompt, tool);

    // 6. Insert debrief record
    const debriefRows = await this.tenantManager.executeInTenant<DebriefRow[]>(
      tenant.orgSlug,
      `INSERT INTO debriefs (session_id, surrogate_id, summary, decisions, escalations, edge_cases, recommendations, generated_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, NOW())
       RETURNING *`,
      [
        sessionId,
        session.surrogateId,
        result.summary,
        JSON.stringify(result.decisions),
        JSON.stringify(result.escalations),
        JSON.stringify(result.edgeCases),
        JSON.stringify(result.recommendations),
      ],
    );

    // 7. Audit
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: session.surrogateId,
      userId,
      action: AuditAction.DEBRIEF_GENERATED,
      details: { sessionId, debriefId: debriefRows[0].id },
    });

    return mapDebriefRow(debriefRows[0]);
  }

  async getDebrief(tenant: TenantContext, sessionId: string) {
    const rows = await this.tenantManager.executeInTenant<DebriefRow[]>(
      tenant.orgSlug,
      `SELECT * FROM debriefs WHERE session_id = $1::uuid`,
      [sessionId],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Debrief not found for this session');
    }

    return mapDebriefRow(rows[0]);
  }

  async listDebriefs(tenant: TenantContext, pagination: PaginationParams) {
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM debriefs`,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<DebriefRow[]>(
      tenant.orgSlug,
      `SELECT * FROM debriefs ORDER BY generated_at DESC LIMIT $1 OFFSET $2`,
      [pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapDebriefRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getAnalytics(tenant: TenantContext, surrogateId?: string) {
    const surrogateFilter = surrogateId ? `WHERE surrogate_id = $1::uuid` : '';
    const params = surrogateId ? [surrogateId] : [];

    const sessionCountRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM sessions ${surrogateFilter}`,
      params,
    );

    const debriefCountRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM debriefs ${surrogateFilter}`,
      params,
    );

    const avgDecisionsRows = await this.tenantManager.executeInTenant<{ avg: string | null }[]>(
      tenant.orgSlug,
      surrogateId
        ? `SELECT AVG(cnt)::text as avg FROM (SELECT COUNT(*) as cnt FROM decision_outcomes WHERE surrogate_id = $1::uuid GROUP BY session_id) sub`
        : `SELECT AVG(cnt)::text as avg FROM (SELECT COUNT(*) as cnt FROM decision_outcomes GROUP BY session_id) sub`,
      params,
    );

    const escalationFilter = surrogateId
      ? `WHERE surrogate_id = $1::uuid AND escalations != '[]'::jsonb`
      : `WHERE escalations != '[]'::jsonb`;

    const escalationCountRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM debriefs ${escalationFilter}`,
      params,
    );

    return {
      totalSessions: Number(sessionCountRows[0].count),
      totalDebriefs: Number(debriefCountRows[0].count),
      avgDecisionsPerSession: avgDecisionsRows[0].avg ? parseFloat(avgDecisionsRows[0].avg) : 0,
      escalationCount: Number(escalationCountRows[0].count),
    };
  }
}
