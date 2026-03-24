import type { PrismaClient } from '@prisma/client';
import type { FleetStatus, PaginatedResponse } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';

// --- Row interfaces (snake_case from DB) ---

interface StatusCountRow {
  status: string;
  count: number;
}

interface SessionCountRow {
  count: number;
}

interface EnrichedSurrogateRow {
  id: string;
  role_title: string;
  domain: string;
  jurisdiction: string;
  status: string;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  session_count: number;
  decision_count: number;
  last_session_at: Date | null;
}

interface CountRow {
  count: bigint;
}

interface HealthRow {
  total_sessions: number;
  total_decisions: number;
  avg_confidence: number | null;
  escalation_count: number;
  last_session_at: Date | null;
}

interface AnalyticsRow {
  total_sessions: number;
  total_decisions: number;
  avg_decisions_per_session: number | null;
  total_debriefs: number;
  total_escalations: number;
}

interface DomainCountRow {
  domain: string;
  count: number;
}

interface ActiveSessionRow {
  id: string;
  surrogate_id: string;
  status: string;
  metadata: Record<string, unknown>;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
  role_title: string;
}

// --- Mapper functions ---

function mapEnrichedSurrogateRow(row: EnrichedSurrogateRow) {
  return {
    id: row.id,
    roleTitle: row.role_title,
    domain: row.domain,
    jurisdiction: row.jurisdiction,
    status: row.status,
    config: row.config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sessionCount: row.session_count,
    decisionCount: row.decision_count,
    lastSessionAt: row.last_session_at,
  };
}

function mapActiveSessionRow(row: ActiveSessionRow) {
  return {
    id: row.id,
    surrogateId: row.surrogate_id,
    status: row.status,
    metadata: row.metadata,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    roleTitle: row.role_title,
  };
}

// --- Filter interface ---

interface FleetFilters {
  domain?: string;
  status?: string;
  jurisdiction?: string;
}

export class FleetService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async getFleetStatus(tenant: TenantContext): Promise<FleetStatus> {
    const statusRows = await this.tenantManager.executeInTenant<StatusCountRow[]>(
      tenant.orgSlug,
      `SELECT status, COUNT(*)::int as count FROM surrogates GROUP BY status`,
    );

    const statusMap: Record<string, number> = {};
    for (const row of statusRows) {
      statusMap[row.status] = row.count;
    }

    const totalSessionRows = await this.tenantManager.executeInTenant<SessionCountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*)::int as count FROM sessions`,
    );

    const activeSessionRows = await this.tenantManager.executeInTenant<SessionCountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*)::int as count FROM sessions WHERE status = 'ACTIVE'`,
    );

    return {
      active: statusMap['ACTIVE'] ?? 0,
      idle: statusMap['DRAFT'] ?? 0,
      paused: statusMap['PAUSED'] ?? 0,
      archived: statusMap['ARCHIVED'] ?? 0,
      totalSessions: totalSessionRows[0]?.count ?? 0,
      activeSessions: activeSessionRows[0]?.count ?? 0,
    };
  }

  async getEnrichedSurrogates(
    tenant: TenantContext,
    filters: FleetFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<ReturnType<typeof mapEnrichedSurrogateRow>>> {
    const whereClauses: string[] = [`s.status != 'ARCHIVED'`];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.domain) {
      whereClauses.push(`s.domain = $${paramIndex++}`);
      params.push(filters.domain);
    }
    if (filters.status) {
      whereClauses.push(`s.status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters.jurisdiction) {
      whereClauses.push(`s.jurisdiction = $${paramIndex++}`);
      params.push(filters.jurisdiction);
    }

    const whereClause = whereClauses.join(' AND ');

    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM surrogates s WHERE ${whereClause}`,
      params,
    );
    const total = Number(countRows[0].count);

    const dataParams = [...params, pagination.take, pagination.skip];
    const rows = await this.tenantManager.executeInTenant<EnrichedSurrogateRow[]>(
      tenant.orgSlug,
      `SELECT s.*,
        (SELECT COUNT(*)::int FROM sessions WHERE surrogate_id = s.id) as session_count,
        (SELECT COUNT(*)::int FROM decision_outcomes WHERE surrogate_id = s.id) as decision_count,
        (SELECT MAX(started_at) FROM sessions WHERE surrogate_id = s.id) as last_session_at
       FROM surrogates s
       WHERE ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      dataParams,
    );

    return buildPaginatedResponse(
      rows.map(mapEnrichedSurrogateRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getSurrogateHealth(tenant: TenantContext, surrogateId: string) {
    // Verify surrogate exists
    const surrogateRows = await this.tenantManager.executeInTenant<{ id: string; role_title: string }[]>(
      tenant.orgSlug,
      `SELECT id, role_title FROM surrogates WHERE id = $1::uuid`,
      [surrogateId],
    );

    if (surrogateRows.length === 0) {
      throw new NotFoundError('Surrogate not found');
    }

    const healthRows = await this.tenantManager.executeInTenant<HealthRow[]>(
      tenant.orgSlug,
      `SELECT
        (SELECT COUNT(*)::int FROM sessions WHERE surrogate_id = $1::uuid) as total_sessions,
        (SELECT COUNT(*)::int FROM decision_outcomes WHERE surrogate_id = $1::uuid) as total_decisions,
        (SELECT AVG(confidence)::float FROM decision_outcomes WHERE surrogate_id = $1::uuid AND confidence IS NOT NULL) as avg_confidence,
        (SELECT COUNT(*)::int FROM debriefs WHERE surrogate_id = $1::uuid AND escalations::text != '[]') as escalation_count,
        (SELECT MAX(started_at) FROM sessions WHERE surrogate_id = $1::uuid) as last_session_at`,
      [surrogateId],
    );

    const health = healthRows[0];

    return {
      surrogateId,
      roleTitle: surrogateRows[0].role_title,
      totalSessions: health.total_sessions,
      totalDecisions: health.total_decisions,
      avgConfidence: health.avg_confidence,
      escalationCount: health.escalation_count,
      lastSessionAt: health.last_session_at,
    };
  }

  async getFleetAnalytics(tenant: TenantContext) {
    const analyticsRows = await this.tenantManager.executeInTenant<AnalyticsRow[]>(
      tenant.orgSlug,
      `SELECT
        (SELECT COUNT(*)::int FROM sessions) as total_sessions,
        (SELECT COUNT(*)::int FROM decision_outcomes) as total_decisions,
        (SELECT AVG(dc)::float FROM (
          SELECT COUNT(*)::int as dc FROM decision_outcomes GROUP BY session_id
        ) sub) as avg_decisions_per_session,
        (SELECT COUNT(*)::int FROM debriefs) as total_debriefs,
        (SELECT COUNT(*)::int FROM debriefs WHERE escalations::text != '[]') as total_escalations`,
    );

    const domainRows = await this.tenantManager.executeInTenant<DomainCountRow[]>(
      tenant.orgSlug,
      `SELECT domain, COUNT(*)::int as count
       FROM surrogates
       WHERE status != 'ARCHIVED'
       GROUP BY domain
       ORDER BY count DESC
       LIMIT 10`,
    );

    const analytics = analyticsRows[0];

    return {
      totalSessions: analytics.total_sessions,
      totalDecisions: analytics.total_decisions,
      avgDecisionsPerSession: analytics.avg_decisions_per_session ?? 0,
      totalDebriefs: analytics.total_debriefs,
      totalEscalations: analytics.total_escalations,
      topDomains: domainRows.map((r) => ({ domain: r.domain, count: r.count })),
    };
  }

  async getActiveSessions(tenant: TenantContext) {
    const rows = await this.tenantManager.executeInTenant<ActiveSessionRow[]>(
      tenant.orgSlug,
      `SELECT s.*, sur.role_title
       FROM sessions s
       JOIN surrogates sur ON s.surrogate_id = sur.id
       WHERE s.status = 'ACTIVE'
       ORDER BY s.started_at DESC`,
    );

    return rows.map(mapActiveSessionRow);
  }
}
