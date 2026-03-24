import type { PrismaClient } from '@prisma/client';
import { AuditAction, BiasCheckStatus } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { getLLMSettings, callLLM } from '../../lib/llm-provider.js';
import { OrgService } from '../orgs/orgs.service.js';
import {
  buildBiasSystemPrompt,
  buildBiasAnalysisPrompt,
  buildBiasAnalysisTool,
} from './prompts.js';

// ── Row types ────────────────────────────────────────────────────────

interface BiasCheckRow {
  id: string;
  surrogate_id: string | null;
  status: string;
  analysis: Record<string, unknown>;
  decision_sample_size: number;
  anomalies: Record<string, unknown>[];
  recommendations: Record<string, unknown>[];
  confidence: number | null;
  triggered_by: string;
  completed_at: Date | null;
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
  surrogate_id: string;
  summary: string;
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

interface DistributionRow {
  surrogate_id: string;
  total_decisions: number;
  avg_confidence: number;
  decisions_with_outcomes: number;
}

interface DashboardStatsRow {
  total_checks: bigint;
  latest_check_date: Date | null;
  avg_bias_score: string | null;
  total_anomalies: bigint;
}

// ── Row mappers ──────────────────────────────────────────────────────

function mapBiasCheckRow(row: BiasCheckRow) {
  return {
    id: row.id,
    surrogateId: row.surrogate_id,
    status: row.status,
    analysis: row.analysis,
    decisionSampleSize: row.decision_sample_size,
    anomalies: row.anomalies,
    recommendations: row.recommendations,
    confidence: row.confidence,
    triggeredBy: row.triggered_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

// ── LLM result type ──────────────────────────────────────────────────

interface BiasLLMResult {
  overallAssessment: string;
  biasScore: number;
  anomalies: { category: string; description: string; severity: string; evidence: string }[];
  recommendations: { title: string; description: string; priority: string; actionItems: string[] }[];
  statisticalSummary: {
    decisionCount: number;
    avgConfidence: number;
    escalationRate: number;
    outcomeDistribution: Record<string, number>;
  };
}

// ── Bias Service ─────────────────────────────────────────────────────

export class BiasService {
  private orgService: OrgService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {
    this.orgService = new OrgService(prisma);
  }

  async triggerBiasCheck(
    tenant: TenantContext,
    input: { surrogateId?: string },
    userId: string,
  ) {
    const surrogateId = input.surrogateId ?? null;

    // 1. Fetch decision_outcomes (last 100 decisions for the scope)
    const decisionQuery = surrogateId
      ? `SELECT * FROM decision_outcomes WHERE surrogate_id = $1::uuid ORDER BY created_at DESC LIMIT 100`
      : `SELECT * FROM decision_outcomes ORDER BY created_at DESC LIMIT 100`;
    const decisionParams = surrogateId ? [surrogateId] : [];

    const decisions = await this.tenantManager.executeInTenant<DecisionOutcomeRow[]>(
      tenant.orgSlug,
      decisionQuery,
      decisionParams,
    );

    // 2. Fetch debriefs for the scope
    const debriefQuery = surrogateId
      ? `SELECT surrogate_id, summary, generated_at FROM debriefs WHERE surrogate_id = $1::uuid ORDER BY generated_at DESC LIMIT 10`
      : `SELECT surrogate_id, summary, generated_at FROM debriefs ORDER BY generated_at DESC LIMIT 10`;
    const debriefParams = surrogateId ? [surrogateId] : [];

    const debriefs = await this.tenantManager.executeInTenant<DebriefRow[]>(
      tenant.orgSlug,
      debriefQuery,
      debriefParams,
    );

    // 3. Optionally fetch surrogate info
    let surrogateInfo: { roleTitle: string; domain: string } | undefined;
    if (surrogateId) {
      try {
        const surrogateRows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
          tenant.orgSlug,
          `SELECT id, role_title, domain FROM surrogates WHERE id = $1::uuid`,
          [surrogateId],
        );
        if (surrogateRows.length > 0) {
          surrogateInfo = {
            roleTitle: surrogateRows[0].role_title,
            domain: surrogateRows[0].domain,
          };
        }
      } catch {
        // Non-critical — proceed without surrogate details
      }
    }

    // 4. Audit: BIAS_CHECK_TRIGGERED
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: surrogateId,
      userId,
      action: AuditAction.BIAS_CHECK_TRIGGERED,
      details: { surrogateId, decisionCount: decisions.length },
    });

    // 5. Build LLM prompts & call LLM
    const systemPrompt = buildBiasSystemPrompt();
    const userPrompt = buildBiasAnalysisPrompt({
      surrogateId,
      surrogateInfo,
      decisions: decisions.map((d) => ({
        decision: d.decision,
        outcome: d.outcome,
        confidence: d.confidence,
        context: d.context,
        surrogateId: d.surrogate_id,
        createdAt: d.created_at.toISOString(),
      })),
      debriefSummaries: debriefs.map((d) => ({
        surrogateId: d.surrogate_id,
        summary: d.summary,
        generatedAt: d.generated_at.toISOString(),
      })),
    });

    const llmSettings = await getLLMSettings(this.orgService, tenant.orgId);
    const tool = buildBiasAnalysisTool();

    let result: BiasLLMResult;
    let status = BiasCheckStatus.COMPLETED;
    try {
      result = await callLLM<BiasLLMResult>(llmSettings, systemPrompt, userPrompt, tool);
    } catch {
      // Insert a FAILED record
      const failedRows = await this.tenantManager.executeInTenant<BiasCheckRow[]>(
        tenant.orgSlug,
        `INSERT INTO bias_checks (surrogate_id, status, analysis, decision_sample_size, anomalies, recommendations, confidence, triggered_by)
         VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7, $8::uuid)
         RETURNING *`,
        [surrogateId, BiasCheckStatus.FAILED, JSON.stringify({}), decisions.length, JSON.stringify([]), JSON.stringify([]), null, userId],
      );
      return mapBiasCheckRow(failedRows[0]);
    }

    // 6. Insert bias_check record
    const biasCheckRows = await this.tenantManager.executeInTenant<BiasCheckRow[]>(
      tenant.orgSlug,
      `INSERT INTO bias_checks (surrogate_id, status, analysis, decision_sample_size, anomalies, recommendations, confidence, triggered_by, completed_at)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7, $8::uuid, NOW())
       RETURNING *`,
      [
        surrogateId,
        status,
        JSON.stringify({
          overallAssessment: result.overallAssessment,
          biasScore: result.biasScore,
          statisticalSummary: result.statisticalSummary,
        }),
        decisions.length,
        JSON.stringify(result.anomalies),
        JSON.stringify(result.recommendations),
        result.biasScore,
        userId,
      ],
    );

    // 7. Audit: BIAS_CHECK_COMPLETED
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: surrogateId,
      userId,
      action: AuditAction.BIAS_CHECK_COMPLETED,
      details: {
        biasCheckId: biasCheckRows[0].id,
        biasScore: result.biasScore,
        anomalyCount: result.anomalies.length,
      },
    });

    return mapBiasCheckRow(biasCheckRows[0]);
  }

  async listChecks(tenant: TenantContext, pagination: PaginationParams) {
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM bias_checks`,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<BiasCheckRow[]>(
      tenant.orgSlug,
      `SELECT * FROM bias_checks ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapBiasCheckRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getCheck(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<BiasCheckRow[]>(
      tenant.orgSlug,
      `SELECT * FROM bias_checks WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Bias check not found');
    }

    return mapBiasCheckRow(rows[0]);
  }

  async getDecisionDistribution(tenant: TenantContext, surrogateId?: string) {
    const query = surrogateId
      ? `SELECT surrogate_id, COUNT(*)::int as total_decisions,
           AVG(confidence)::float as avg_confidence,
           COUNT(CASE WHEN outcome IS NOT NULL THEN 1 END)::int as decisions_with_outcomes
         FROM decision_outcomes
         WHERE surrogate_id = $1::uuid
         GROUP BY surrogate_id`
      : `SELECT surrogate_id, COUNT(*)::int as total_decisions,
           AVG(confidence)::float as avg_confidence,
           COUNT(CASE WHEN outcome IS NOT NULL THEN 1 END)::int as decisions_with_outcomes
         FROM decision_outcomes
         GROUP BY surrogate_id`;
    const params = surrogateId ? [surrogateId] : [];

    const rows = await this.tenantManager.executeInTenant<DistributionRow[]>(
      tenant.orgSlug,
      query,
      params,
    );

    return rows.map((r) => ({
      surrogateId: r.surrogate_id,
      totalDecisions: r.total_decisions,
      avgConfidence: r.avg_confidence,
      decisionsWithOutcomes: r.decisions_with_outcomes,
    }));
  }

  async getAnomalies(tenant: TenantContext) {
    const rows = await this.tenantManager.executeInTenant<BiasCheckRow[]>(
      tenant.orgSlug,
      `SELECT * FROM bias_checks WHERE anomalies != '[]'::jsonb ORDER BY created_at DESC LIMIT 20`,
    );

    return rows.map(mapBiasCheckRow);
  }

  async getDashboardData(tenant: TenantContext) {
    // Total checks, latest check date, avg bias score, total anomalies
    const statsRows = await this.tenantManager.executeInTenant<DashboardStatsRow[]>(
      tenant.orgSlug,
      `SELECT
         COUNT(*)::bigint as total_checks,
         MAX(created_at) as latest_check_date,
         AVG(confidence)::text as avg_bias_score,
         COALESCE(SUM(jsonb_array_length(anomalies)), 0)::bigint as total_anomalies
       FROM bias_checks
       WHERE status = $1`,
      [BiasCheckStatus.COMPLETED],
    );

    const stats = statsRows[0];

    // Decision distribution summary
    const distribution = await this.getDecisionDistribution(tenant);

    // Top recommendations from latest checks
    const latestChecks = await this.tenantManager.executeInTenant<BiasCheckRow[]>(
      tenant.orgSlug,
      `SELECT * FROM bias_checks WHERE status = $1 ORDER BY created_at DESC LIMIT 5`,
      [BiasCheckStatus.COMPLETED],
    );

    const topRecommendations = latestChecks
      .flatMap((c) => c.recommendations)
      .slice(0, 10);

    return {
      totalChecks: Number(stats.total_checks),
      latestCheckDate: stats.latest_check_date,
      avgBiasScore: stats.avg_bias_score ? parseFloat(stats.avg_bias_score) : null,
      totalAnomalies: Number(stats.total_anomalies),
      decisionDistribution: distribution,
      topRecommendations,
    };
  }
}
