import type { PrismaClient } from '@prisma/client';
import { AuditAction, HandoffStatus } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { getLLMSettings, callLLM } from '../../lib/llm-provider.js';
import { OrgService } from '../orgs/orgs.service.js';
import {
  buildHandoffSystemPrompt,
  buildHandoffSummaryPrompt,
  buildHandoffTool,
} from './prompts.js';

// ── Row types ────────────────────────────────────────────────────────

interface HandoffRow {
  id: string;
  source_surrogate_id: string;
  target_surrogate_id: string | null;
  target_human_id: string | null;
  type: string;
  status: string;
  context_bundle: Record<string, unknown>;
  summary: string | null;
  session_id: string | null;
  initiated_by: string;
  accepted_by: string | null;
  initiated_at: Date;
  accepted_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
}

interface SessionRow {
  id: string;
  surrogate_id: string;
  status: string;
  metadata: Record<string, unknown>;
  started_at: Date;
  ended_at: Date | null;
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

interface MemoryEntryRow {
  id: string;
  surrogate_id: string;
  type: string;
  content: string;
  tags: string[];
  last_observed_at: Date;
}

interface SurrogateRow {
  id: string;
  role_title: string;
  domain: string;
}

interface SOPRow {
  id: string;
  title: string;
  version: number;
  status: string;
}

interface CountRow {
  count: bigint;
}

// ── Row mapper ──────────────────────────────────────────────────────

function mapHandoffRow(row: HandoffRow) {
  return {
    id: row.id,
    sourceSurrogateId: row.source_surrogate_id,
    targetSurrogateId: row.target_surrogate_id,
    targetHumanId: row.target_human_id,
    type: row.type,
    status: row.status,
    contextBundle: row.context_bundle,
    summary: row.summary,
    sessionId: row.session_id,
    initiatedBy: row.initiated_by,
    acceptedBy: row.accepted_by,
    initiatedAt: row.initiated_at,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// ── LLM result type ──────────────────────────────────────────────────

interface HandoffLLMResult {
  summary: string;
  keyDecisions: { decision: string; impact: string; status: string }[];
  openItems: { item: string; priority: string; deadline: string }[];
  recommendations: { title: string; description: string; priority: string }[];
  riskFlags: { risk: string; severity: string; mitigation: string }[];
}

// ── Handoff Service ──────────────────────────────────────────────────

export class HandoffService {
  private orgService: OrgService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {
    this.orgService = new OrgService(prisma);
  }

  async initiateHandoff(
    tenant: TenantContext,
    input: {
      surrogateId: string;
      targetSurrogateId?: string;
      targetHumanId?: string;
      type: string;
      sessionId?: string;
      context?: Record<string, unknown>;
    },
    userId: string,
  ) {
    // 1. Validate source surrogate exists
    const surrogateRows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `SELECT id, role_title, domain FROM surrogates WHERE id = $1::uuid`,
      [input.surrogateId],
    );
    if (surrogateRows.length === 0) {
      throw new NotFoundError('Source surrogate not found');
    }
    const surrogate = surrogateRows[0];

    // 2. Gather context: latest session + decisions + memory entries + active SOP
    let session: SessionRow | null = null;
    let decisions: DecisionOutcomeRow[] = [];

    if (input.sessionId) {
      const sessionRows = await this.tenantManager.executeInTenant<SessionRow[]>(
        tenant.orgSlug,
        `SELECT id, surrogate_id, status, metadata, started_at, ended_at FROM sessions WHERE id = $1::uuid`,
        [input.sessionId],
      );
      if (sessionRows.length > 0) {
        session = sessionRows[0];
      }
    } else {
      // Get the latest session for the surrogate
      const sessionRows = await this.tenantManager.executeInTenant<SessionRow[]>(
        tenant.orgSlug,
        `SELECT id, surrogate_id, status, metadata, started_at, ended_at
         FROM sessions WHERE surrogate_id = $1::uuid
         ORDER BY started_at DESC LIMIT 1`,
        [input.surrogateId],
      );
      if (sessionRows.length > 0) {
        session = sessionRows[0];
      }
    }

    if (session) {
      decisions = await this.tenantManager.executeInTenant<DecisionOutcomeRow[]>(
        tenant.orgSlug,
        `SELECT * FROM decision_outcomes WHERE session_id = $1::uuid ORDER BY created_at ASC`,
        [session.id],
      );
    }

    // Fetch memory entries for the surrogate
    const memoryEntries = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
      tenant.orgSlug,
      `SELECT id, surrogate_id, type, content, tags, last_observed_at
       FROM memory_entries WHERE surrogate_id = $1::uuid
       ORDER BY last_observed_at DESC LIMIT 20`,
      [input.surrogateId],
    );

    // Fetch active SOP for the surrogate
    let activeSop: SOPRow | null = null;
    try {
      const sopRows = await this.tenantManager.executeInTenant<SOPRow[]>(
        tenant.orgSlug,
        `SELECT id, title, version, status FROM sops
         WHERE surrogate_id = $1::uuid AND status = 'CERTIFIED'
         ORDER BY version DESC LIMIT 1`,
        [input.surrogateId],
      );
      if (sopRows.length > 0) {
        activeSop = sopRows[0];
      }
    } catch {
      // Non-critical — proceed without SOP details
    }

    // 3. Call LLM with handoff prompts to generate summary
    const llmSettings = await getLLMSettings(this.orgService, tenant.orgId);
    const systemPrompt = buildHandoffSystemPrompt();
    const userPrompt = buildHandoffSummaryPrompt({
      sourceSurrogateId: input.surrogateId,
      sourceSurrogateRoleTitle: surrogate.role_title,
      sourceSurrogateDomain: surrogate.domain,
      targetSurrogateId: input.targetSurrogateId,
      targetHumanId: input.targetHumanId,
      handoffType: input.type,
      session: session
        ? {
            id: session.id,
            status: session.status,
            startedAt: session.started_at.toISOString(),
            endedAt: session.ended_at?.toISOString() ?? null,
            metadata: session.metadata,
          }
        : undefined,
      decisions: decisions.map((d) => ({
        decision: d.decision,
        outcome: d.outcome,
        confidence: d.confidence,
        sopNodeId: d.sop_node_id,
        context: d.context,
        createdAt: d.created_at.toISOString(),
      })),
      memoryEntries: memoryEntries.map((m) => ({
        type: m.type,
        content: m.content,
        tags: m.tags,
        lastObservedAt: m.last_observed_at.toISOString(),
      })),
      activeSop: activeSop
        ? {
            id: activeSop.id,
            title: activeSop.title,
            version: activeSop.version,
            status: activeSop.status,
          }
        : undefined,
    });

    const tool = buildHandoffTool();
    const result = await callLLM<HandoffLLMResult>(llmSettings, systemPrompt, userPrompt, tool);

    // 4. Build context bundle
    const contextBundle = {
      session: session
        ? {
            id: session.id,
            status: session.status,
            startedAt: session.started_at.toISOString(),
            endedAt: session.ended_at?.toISOString() ?? null,
            metadata: session.metadata,
          }
        : null,
      decisions: decisions.map((d) => ({
        decision: d.decision,
        outcome: d.outcome,
        confidence: d.confidence,
        sopNodeId: d.sop_node_id,
        context: d.context,
        createdAt: d.created_at.toISOString(),
      })),
      memories: memoryEntries.map((m) => ({
        type: m.type,
        content: m.content,
        tags: m.tags,
        lastObservedAt: m.last_observed_at.toISOString(),
      })),
      activeSop: activeSop
        ? { id: activeSop.id, title: activeSop.title, version: activeSop.version, status: activeSop.status }
        : null,
      keyDecisions: result.keyDecisions,
      openItems: result.openItems,
      recommendations: result.recommendations,
      riskFlags: result.riskFlags,
      ...(input.context ?? {}),
    };

    // 5. Insert handoff record
    const handoffRows = await this.tenantManager.executeInTenant<HandoffRow[]>(
      tenant.orgSlug,
      `INSERT INTO handoffs (
        source_surrogate_id, target_surrogate_id, target_human_id,
        type, status, context_bundle, summary, session_id,
        initiated_by, initiated_at
      ) VALUES (
        $1::uuid, $2, $3,
        $4, $5, $6::jsonb, $7, $8,
        $9::uuid, NOW()
      ) RETURNING *`,
      [
        input.surrogateId,
        input.targetSurrogateId ?? null,
        input.targetHumanId ?? null,
        input.type,
        HandoffStatus.INITIATED,
        JSON.stringify(contextBundle),
        result.summary,
        session?.id ?? null,
        userId,
      ],
    );

    // 6. Audit
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: input.surrogateId,
      userId,
      action: AuditAction.HANDOFF_INITIATED,
      details: { handoffId: handoffRows[0].id, type: input.type },
    });

    return mapHandoffRow(handoffRows[0]);
  }

  async acceptHandoff(
    tenant: TenantContext,
    handoffId: string,
    userId: string,
  ) {
    // Validate handoff exists and status is INITIATED
    const existing = await this.getHandoffRow(tenant, handoffId);
    if (existing.status !== HandoffStatus.INITIATED) {
      throw new ValidationError('Only handoffs with INITIATED status can be accepted');
    }

    const rows = await this.tenantManager.executeInTenant<HandoffRow[]>(
      tenant.orgSlug,
      `UPDATE handoffs SET status = $1, accepted_by = $2::uuid, accepted_at = NOW()
       WHERE id = $3::uuid RETURNING *`,
      [HandoffStatus.ACCEPTED, userId, handoffId],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: existing.source_surrogate_id,
      userId,
      action: AuditAction.HANDOFF_ACCEPTED,
      details: { handoffId },
    });

    return mapHandoffRow(rows[0]);
  }

  async rejectHandoff(
    tenant: TenantContext,
    handoffId: string,
    userId: string,
  ) {
    // Validate status is INITIATED
    const existing = await this.getHandoffRow(tenant, handoffId);
    if (existing.status !== HandoffStatus.INITIATED) {
      throw new ValidationError('Only handoffs with INITIATED status can be rejected');
    }

    const rows = await this.tenantManager.executeInTenant<HandoffRow[]>(
      tenant.orgSlug,
      `UPDATE handoffs SET status = $1 WHERE id = $2::uuid RETURNING *`,
      [HandoffStatus.REJECTED, handoffId],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: existing.source_surrogate_id,
      userId,
      action: AuditAction.HANDOFF_REJECTED,
      details: { handoffId },
    });

    return mapHandoffRow(rows[0]);
  }

  async listHandoffs(
    tenant: TenantContext,
    pagination: PaginationParams,
    filters?: { status?: string; type?: string; surrogateId?: string },
  ) {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters?.type) {
      whereClauses.push(`type = $${paramIndex++}`);
      params.push(filters.type);
    }
    if (filters?.surrogateId) {
      whereClauses.push(`(source_surrogate_id = $${paramIndex}::uuid OR target_surrogate_id = $${paramIndex}::uuid)`);
      paramIndex++;
      params.push(filters.surrogateId);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM handoffs ${where}`,
      params,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<HandoffRow[]>(
      tenant.orgSlug,
      `SELECT * FROM handoffs ${where}
       ORDER BY initiated_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapHandoffRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getHandoff(tenant: TenantContext, handoffId: string) {
    const row = await this.getHandoffRow(tenant, handoffId);
    return mapHandoffRow(row);
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async getHandoffRow(tenant: TenantContext, handoffId: string): Promise<HandoffRow> {
    const rows = await this.tenantManager.executeInTenant<HandoffRow[]>(
      tenant.orgSlug,
      `SELECT * FROM handoffs WHERE id = $1::uuid`,
      [handoffId],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Handoff not found');
    }

    return rows[0];
  }
}
