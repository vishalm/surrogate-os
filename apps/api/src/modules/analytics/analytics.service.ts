import type { PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';

// ── Row types ────────────────────────────────────────────────────────

interface CountRow {
  count: bigint;
}

interface NumericRow {
  value: number | null;
}

interface TimeSeriesRow {
  bucket: Date;
  count: bigint;
}

interface SurrogatePerformanceRow {
  total_sessions: bigint;
  avg_confidence: number | null;
  escalation_rate: number | null;
  avg_session_duration_seconds: number | null;
  decisions_per_session: number | null;
}

interface DomainBreakdownRow {
  domain: string;
  surrogate_count: bigint;
  active_count: bigint;
  total_sessions: bigint;
  total_decisions: bigint;
}

interface ComplianceOverviewRow {
  surrogate_id: string;
  role_title: string;
  framework_id: string;
  status: string;
  checked_at: Date;
  score: number | null;
}

interface HeatmapRow {
  hour_bucket: number;
  decision_count: bigint;
}

interface RecentActivityRow {
  action: string;
  details: Record<string, unknown>;
  created_at: Date;
  surrogate_id: string | null;
}

interface SessionRow {
  id: string;
  surrogate_id: string;
  status: string;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}

interface DecisionRow {
  id: string;
  session_id: string;
  node_id: string;
  decision: string;
  confidence: number | null;
  created_at: Date;
}

// ── Metric types ─────────────────────────────────────────────────────

export type TimeSeriesMetric =
  | 'sessions_created'
  | 'decisions_made'
  | 'sops_generated'
  | 'compliance_checks'
  | 'executions_completed';

export type TimeSeriesPeriod = 'day' | 'week' | 'month';

export type ExportFormat = 'csv' | 'json';

export interface ExportFilters {
  metric?: TimeSeriesMetric;
  startDate?: string;
  endDate?: string;
  surrogateId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const METRIC_TABLE_MAP: Record<TimeSeriesMetric, { table: string; dateCol: string }> = {
  sessions_created: { table: 'sessions', dateCol: 'created_at' },
  decisions_made: { table: 'decisions', dateCol: 'created_at' },
  sops_generated: { table: 'sops', dateCol: 'created_at' },
  compliance_checks: { table: 'compliance_checks', dateCol: 'checked_at' },
  executions_completed: { table: 'executions', dateCol: 'completed_at' },
};

const VALID_PERIODS: TimeSeriesPeriod[] = ['day', 'week', 'month'];
const VALID_METRICS: TimeSeriesMetric[] = [
  'sessions_created',
  'decisions_made',
  'sops_generated',
  'compliance_checks',
  'executions_completed',
];

// ── Service ──────────────────────────────────────────────────────────

export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  // ── Dashboard Metrics ──────────────────────────────────────────────

  async getDashboardMetrics(tenant: TenantContext) {
    const [
      totalSurrogates,
      totalSOPs,
      totalSessions,
      totalDecisions,
      avgConfidence,
      complianceScore,
    ] = await Promise.all([
      this.count(tenant, `SELECT COUNT(*) as count FROM surrogates WHERE status != 'ARCHIVED'`),
      this.count(tenant, `SELECT COUNT(*) as count FROM sops`),
      this.count(tenant, `SELECT COUNT(*) as count FROM sessions`),
      this.count(tenant, `SELECT COUNT(*) as count FROM decision_outcomes`),
      this.numericValue(
        tenant,
        `SELECT AVG(confidence) as value FROM decision_outcomes WHERE confidence IS NOT NULL`,
      ),
      this.numericValue(
        tenant,
        `SELECT AVG(CASE WHEN status = 'PASS' THEN 100.0 WHEN status = 'PARTIAL' THEN 50.0 ELSE 0.0 END) as value
         FROM compliance_checks`,
      ),
    ]);

    return {
      totalSurrogates,
      totalSOPs,
      totalSessions,
      totalDecisions,
      avgConfidence: avgConfidence !== null ? Math.round(avgConfidence * 100) / 100 : null,
      complianceScore: complianceScore !== null ? Math.round(complianceScore * 100) / 100 : null,
    };
  }

  // ── Time Series ────────────────────────────────────────────────────

  async getTimeSeriesData(
    tenant: TenantContext,
    metric: string,
    period: string,
    startDate: string,
    endDate: string,
  ) {
    if (!VALID_METRICS.includes(metric as TimeSeriesMetric)) {
      throw new ValidationError(`Invalid metric: ${metric}. Valid: ${VALID_METRICS.join(', ')}`);
    }
    if (!VALID_PERIODS.includes(period as TimeSeriesPeriod)) {
      throw new ValidationError(`Invalid period: ${period}. Valid: ${VALID_PERIODS.join(', ')}`);
    }

    const tableInfo = METRIC_TABLE_MAP[metric as TimeSeriesMetric];

    // For executions_completed, only count completed rows where completed_at is not null
    const extraWhere =
      metric === 'executions_completed'
        ? `AND ${tableInfo.dateCol} IS NOT NULL`
        : '';

    const rows = await this.tenantManager.executeInTenant<TimeSeriesRow[]>(
      tenant.orgSlug,
      `SELECT
         date_trunc($1, ${tableInfo.dateCol}) AS bucket,
         COUNT(*) AS count
       FROM ${tableInfo.table}
       WHERE ${tableInfo.dateCol} >= $2::timestamptz
         AND ${tableInfo.dateCol} <= $3::timestamptz
         ${extraWhere}
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [period, startDate, endDate],
    );

    return rows.map((r) => ({
      bucket: r.bucket,
      count: Number(r.count),
    }));
  }

  // ── Surrogate Performance ──────────────────────────────────────────

  async getSurrogatePerformance(tenant: TenantContext, surrogateId: string) {
    const rows = await this.tenantManager.executeInTenant<SurrogatePerformanceRow[]>(
      tenant.orgSlug,
      `SELECT
         (SELECT COUNT(*) FROM sessions WHERE surrogate_id = $1::uuid) AS total_sessions,
         (SELECT AVG(confidence) FROM decision_outcomes d
          JOIN sessions s ON s.id = d.session_id
          WHERE s.surrogate_id = $1::uuid AND d.confidence IS NOT NULL) AS avg_confidence,
         (SELECT
            CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(SUM(CASE WHEN e.status = 'ESCALATED' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100, 2)
            END
          FROM executions e WHERE e.surrogate_id = $1::uuid) AS escalation_rate,
         (SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)))
          FROM sessions WHERE surrogate_id = $1::uuid AND started_at IS NOT NULL) AS avg_session_duration_seconds,
         (SELECT
            CASE WHEN COUNT(DISTINCT s.id) = 0 THEN 0
            ELSE ROUND(COUNT(d.id)::numeric / COUNT(DISTINCT s.id)::numeric, 2)
            END
          FROM sessions s
          LEFT JOIN decisions d ON d.session_id = s.id
          WHERE s.surrogate_id = $1::uuid) AS decisions_per_session`,
      [surrogateId],
    );

    const row = rows[0];
    return {
      totalSessions: Number(row?.total_sessions ?? 0),
      avgConfidence: row?.avg_confidence !== null ? Math.round((row?.avg_confidence ?? 0) * 100) / 100 : null,
      escalationRate: row?.escalation_rate !== null ? Number(row?.escalation_rate ?? 0) : 0,
      avgSessionDurationSeconds: row?.avg_session_duration_seconds !== null
        ? Math.round(Number(row?.avg_session_duration_seconds ?? 0))
        : null,
      decisionsPerSession: row?.decisions_per_session !== null ? Number(row?.decisions_per_session ?? 0) : 0,
    };
  }

  // ── Domain Breakdown ───────────────────────────────────────────────

  async getDomainBreakdown(tenant: TenantContext) {
    const rows = await this.tenantManager.executeInTenant<DomainBreakdownRow[]>(
      tenant.orgSlug,
      `SELECT
         s.domain,
         COUNT(DISTINCT s.id) AS surrogate_count,
         COUNT(DISTINCT CASE WHEN s.status = 'ACTIVE' THEN s.id END) AS active_count,
         COUNT(DISTINCT sess.id) AS total_sessions,
         COUNT(d.id) AS total_decisions
       FROM surrogates s
       LEFT JOIN sessions sess ON sess.surrogate_id = s.id
       LEFT JOIN decisions d ON d.session_id = sess.id
       WHERE s.status != 'ARCHIVED'
       GROUP BY s.domain
       ORDER BY surrogate_count DESC`,
    );

    return rows.map((r) => ({
      domain: r.domain,
      surrogateCount: Number(r.surrogate_count),
      activeCount: Number(r.active_count),
      totalSessions: Number(r.total_sessions),
      totalDecisions: Number(r.total_decisions),
    }));
  }

  // ── Compliance Overview ────────────────────────────────────────────

  async getComplianceOverview(tenant: TenantContext) {
    const rows = await this.tenantManager.executeInTenant<ComplianceOverviewRow[]>(
      tenant.orgSlug,
      `SELECT DISTINCT ON (cc.surrogate_id, cc.framework_id)
         cc.surrogate_id,
         s.role_title,
         cc.framework_id,
         cc.status,
         cc.checked_at,
         cc.score
       FROM compliance_checks cc
       JOIN surrogates s ON s.id = cc.surrogate_id
       WHERE s.status != 'ARCHIVED'
       ORDER BY cc.surrogate_id, cc.framework_id, cc.checked_at DESC`,
    );

    return rows.map((r) => ({
      surrogateId: r.surrogate_id,
      roleTitle: r.role_title,
      frameworkId: r.framework_id,
      status: r.status,
      checkedAt: r.checked_at,
      score: r.score,
    }));
  }

  // ── Decision Heatmap ───────────────────────────────────────────────

  async getDecisionHeatmap(tenant: TenantContext, surrogateId?: string) {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (surrogateId) {
      whereClauses.push(`s.surrogate_id = $${paramIndex++}::uuid`);
      params.push(surrogateId);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const rows = await this.tenantManager.executeInTenant<HeatmapRow[]>(
      tenant.orgSlug,
      `SELECT
         EXTRACT(HOUR FROM d.created_at) AS hour_bucket,
         COUNT(*) AS decision_count
       FROM decision_outcomes d
       JOIN sessions s ON s.id = d.session_id
       ${where}
       GROUP BY hour_bucket
       ORDER BY hour_bucket ASC`,
      params,
    );

    // Fill all 24 hours (0-23) with 0 defaults
    const heatmap: { hour: number; count: number }[] = [];
    const rowMap = new Map(rows.map((r) => [Number(r.hour_bucket), Number(r.decision_count)]));
    for (let h = 0; h < 24; h++) {
      heatmap.push({ hour: h, count: rowMap.get(h) ?? 0 });
    }

    return heatmap;
  }

  // ── Top Insights ───────────────────────────────────────────────────

  async getTopInsights(tenant: TenantContext) {
    // Generate insights from recent activity data rather than calling LLM
    const [recentActivity, totalSurrogates, activeSessions, recentDecisions] = await Promise.all([
      this.tenantManager.executeInTenant<RecentActivityRow[]>(
        tenant.orgSlug,
        `SELECT action, details, created_at, surrogate_id
         FROM audit_entries
         ORDER BY created_at DESC
         LIMIT 50`,
      ),
      this.count(tenant, `SELECT COUNT(*) as count FROM surrogates WHERE status = 'ACTIVE'`),
      this.count(
        tenant,
        `SELECT COUNT(*) as count FROM sessions WHERE status = 'ACTIVE'`,
      ),
      this.count(
        tenant,
        `SELECT COUNT(*) as count FROM decision_outcomes WHERE created_at > NOW() - INTERVAL '24 hours'`,
      ),
    ]);

    const insights: { type: string; title: string; description: string }[] = [];

    // Activity trend insight
    const last24hActions = recentActivity.filter(
      (a) => new Date(a.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000,
    ).length;

    if (last24hActions > 20) {
      insights.push({
        type: 'trend',
        title: 'High Activity',
        description: `${last24hActions} audit events in the last 24 hours indicating significant platform activity.`,
      });
    } else if (last24hActions === 0) {
      insights.push({
        type: 'trend',
        title: 'Low Activity',
        description: 'No audit events in the last 24 hours. Consider reviewing surrogate configurations.',
      });
    }

    // Active sessions insight
    if (activeSessions > 0) {
      insights.push({
        type: 'status',
        title: 'Active Sessions',
        description: `${activeSessions} session${activeSessions !== 1 ? 's' : ''} currently running across ${totalSurrogates} active surrogate${totalSurrogates !== 1 ? 's' : ''}.`,
      });
    }

    // Decision velocity insight
    if (recentDecisions > 0) {
      insights.push({
        type: 'metric',
        title: 'Decision Velocity',
        description: `${recentDecisions} decision${recentDecisions !== 1 ? 's' : ''} made in the last 24 hours.`,
      });
    }

    // Escalation detection
    const escalations = recentActivity.filter((a) => a.action.includes('ESCALAT'));
    if (escalations.length > 0) {
      insights.push({
        type: 'alert',
        title: 'Recent Escalations',
        description: `${escalations.length} escalation${escalations.length !== 1 ? 's' : ''} detected in recent activity. Review surrogate decision boundaries.`,
      });
    }

    // SOP changes insight
    const sopChanges = recentActivity.filter((a) => a.action.startsWith('SOP_'));
    if (sopChanges.length > 0) {
      insights.push({
        type: 'info',
        title: 'SOP Updates',
        description: `${sopChanges.length} SOP-related change${sopChanges.length !== 1 ? 's' : ''} in recent activity.`,
      });
    }

    // Fallback if no insights generated
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: 'Getting Started',
        description: 'Create surrogates and run sessions to generate actionable analytics insights.',
      });
    }

    return insights;
  }

  // ── Export Report ──────────────────────────────────────────────────

  async exportReport(
    tenant: TenantContext,
    format: string,
    filters: ExportFilters,
  ) {
    if (format !== 'csv' && format !== 'json') {
      throw new ValidationError(`Invalid format: ${format}. Valid: csv, json`);
    }

    // Build the query based on filters
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.surrogateId) {
      whereClauses.push(`s.surrogate_id = $${paramIndex++}::uuid`);
      params.push(filters.surrogateId);
    }
    if (filters.startDate) {
      whereClauses.push(`ae.created_at >= $${paramIndex++}::timestamptz`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClauses.push(`ae.created_at <= $${paramIndex++}::timestamptz`);
      params.push(filters.endDate);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const rows = await this.tenantManager.executeInTenant<{
      id: string;
      action: string;
      surrogate_id: string | null;
      user_id: string;
      details: Record<string, unknown>;
      created_at: Date;
    }[]>(
      tenant.orgSlug,
      `SELECT ae.id, ae.action, ae.surrogate_id, ae.user_id, ae.details, ae.created_at
       FROM audit_entries ae
       LEFT JOIN sessions s ON s.surrogate_id = ae.surrogate_id
       ${where}
       ORDER BY ae.created_at DESC
       LIMIT 10000`,
      params,
    );

    const mappedRows = rows.map((r) => ({
      id: r.id,
      action: r.action,
      surrogateId: r.surrogate_id,
      userId: r.user_id,
      details: r.details,
      createdAt: r.created_at,
    }));

    if (format === 'json') {
      return {
        format: 'json',
        contentType: 'application/json',
        data: mappedRows,
        filename: `analytics-report-${new Date().toISOString().slice(0, 10)}.json`,
      };
    }

    // CSV format
    const headers = ['id', 'action', 'surrogateId', 'userId', 'details', 'createdAt'];
    const csvLines = [headers.join(',')];

    for (const row of mappedRows) {
      csvLines.push(
        [
          row.id,
          row.action,
          row.surrogateId ?? '',
          row.userId,
          `"${JSON.stringify(row.details).replace(/"/g, '""')}"`,
          new Date(row.createdAt).toISOString(),
        ].join(','),
      );
    }

    return {
      format: 'csv',
      contentType: 'text/csv',
      data: csvLines.join('\n'),
      filename: `analytics-report-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────

  private async count(tenant: TenantContext, sql: string, params?: unknown[]): Promise<number> {
    const rows = await this.tenantManager.executeInTenant<CountRow[]>(tenant.orgSlug, sql, params);
    return Number(rows[0]?.count ?? 0);
  }

  private async numericValue(
    tenant: TenantContext,
    sql: string,
    params?: unknown[],
  ): Promise<number | null> {
    const rows = await this.tenantManager.executeInTenant<NumericRow[]>(tenant.orgSlug, sql, params);
    return rows[0]?.value ?? null;
  }
}
