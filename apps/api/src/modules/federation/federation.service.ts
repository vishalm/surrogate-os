import type { PrismaClient } from '@prisma/client';
import type {
  CreateFederationContributionInput,
  PaginatedResponse,
} from '@surrogate-os/shared';
import {
  AuditAction,
  FederationContributionStatus,
} from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import {
  anonymizeDecisionData,
  computePrivacyBudget,
  generateAggregateInsights,
  addLaplacianNoise,
} from './differential-privacy.js';
import { createHash } from 'node:crypto';

export class FederationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  /**
   * Contribute anonymized decision data to the federation pool.
   */
  async createContribution(
    tenant: TenantContext,
    input: CreateFederationContributionInput,
    userId: string,
  ) {
    // Check opt-in status
    const settings = await this.getOrCreateSettings(tenant.orgId);
    if (!settings.optedIn) {
      throw new ForbiddenError(
        'Organization has not opted into federation. Enable participation first.',
      );
    }

    // Check privacy budget
    const epsilonCost = input.epsilon ?? 1.0;
    if (settings.budgetUsed + epsilonCost > settings.privacyBudget) {
      throw new ValidationError(
        `Privacy budget exceeded. Remaining: ${(settings.privacyBudget - settings.budgetUsed).toFixed(2)}, Required: ${epsilonCost.toFixed(2)}`,
      );
    }

    // Anonymize the decision data
    const anonymized = anonymizeDecisionData(input.decisionData);

    // Compute a hash of the anonymized data for deduplication
    const dataHash = createHash('sha256')
      .update(JSON.stringify(anonymized))
      .digest('hex');

    // Store contribution in public schema
    const contribution = await this.prisma.federationContribution.create({
      data: {
        orgId: tenant.orgId,
        domain: input.domain,
        category: input.category ?? null,
        dataHash,
        anonymizedData: anonymized as object,
        privacyEpsilon: epsilonCost,
        recordCount: anonymized.length,
        status: FederationContributionStatus.ACTIVE,
      },
    });

    // Update privacy budget usage
    await this.prisma.federationSettings.update({
      where: { orgId: tenant.orgId },
      data: {
        budgetUsed: { increment: epsilonCost },
      },
    });

    // Audit
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.FEDERATION_CONTRIBUTION_CREATED,
      details: {
        contributionId: contribution.id,
        domain: input.domain,
        recordCount: anonymized.length,
        epsilon: epsilonCost,
      },
    });

    return contribution;
  }

  /**
   * List the org's own contributions with pagination.
   */
  async listContributions(
    orgId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<object>> {
    const where = { orgId };

    const [contributions, total] = await Promise.all([
      this.prisma.federationContribution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          domain: true,
          category: true,
          dataHash: true,
          privacyEpsilon: true,
          recordCount: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.federationContribution.count({ where }),
    ]);

    return buildPaginatedResponse(contributions, total, pagination.page, pagination.pageSize);
  }

  /**
   * Get aggregated insights from all contributions in the pool.
   * No raw data is ever exposed — only differentially private aggregates.
   */
  async getPoolInsights(domain?: string, category?: string) {
    const where: Record<string, unknown> = {
      status: FederationContributionStatus.ACTIVE,
    };
    if (domain) {
      where.domain = domain;
    }
    if (category) {
      where.category = category;
    }

    const contributions = await this.prisma.federationContribution.findMany({
      where,
      select: {
        domain: true,
        category: true,
        anonymizedData: true,
        recordCount: true,
        privacyEpsilon: true,
      },
    });

    if (contributions.length === 0) {
      return {
        domain: domain ?? 'all',
        category: category ?? null,
        totalContributions: 0,
        totalRecords: 0,
        insights: null,
      };
    }

    // Flatten all anonymized data for aggregation
    const allData: Record<string, unknown>[] = [];
    for (const contrib of contributions) {
      const data = contrib.anonymizedData;
      if (Array.isArray(data)) {
        allData.push(...(data as Record<string, unknown>[]));
      }
    }

    const totalRecords = contributions.reduce((sum, c) => sum + c.recordCount, 0);
    const insights = generateAggregateInsights(allData);

    return {
      domain: domain ?? 'all',
      category: category ?? null,
      totalContributions: contributions.length,
      totalRecords,
      insights,
    };
  }

  /**
   * Apply federated insights as SOP improvement suggestions.
   */
  async applyInsightsToSOP(
    tenant: TenantContext,
    sopId: string,
    insights: Record<string, unknown>[],
    userId: string,
    rationale?: string,
  ) {
    // Verify SOP exists in tenant schema
    const sopRows = await this.tenantManager.executeInTenant<{ id: string; title: string; surrogate_id: string }[]>(
      tenant.orgSlug,
      `SELECT id, title, surrogate_id FROM sops WHERE id = $1::uuid`,
      [sopId],
    );

    if (sopRows.length === 0) {
      throw new NotFoundError('SOP not found in your organization');
    }

    const sop = sopRows[0];

    // Store the application as a proposal-like record in the tenant schema
    const appliedData = {
      type: 'FEDERATION_INSIGHT',
      insights,
      rationale: rationale ?? 'Applied from federation pool insights',
      appliedAt: new Date().toISOString(),
    };

    // Insert as a SOP proposal with FEDERATION source
    await this.tenantManager.executeInTenant(
      tenant.orgSlug,
      `INSERT INTO sop_proposals (sop_id, surrogate_id, proposed_by, status, current_graph, proposed_graph, diff, rationale)
       SELECT $1::uuid, s.surrogate_id, $2::uuid, 'PENDING', s.graph, s.graph, $3::jsonb, $4
       FROM sops s WHERE s.id = $1::uuid`,
      [
        sopId,
        userId,
        JSON.stringify(appliedData),
        `Federation insight: ${rationale ?? 'Cross-org learning improvement suggestion'}`,
      ],
    );

    // Audit
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: sop.surrogate_id,
      userId,
      action: AuditAction.FEDERATION_INSIGHTS_APPLIED,
      details: {
        sopId,
        sopTitle: sop.title,
        insightCount: insights.length,
      },
    });

    return {
      sopId,
      sopTitle: sop.title,
      insightsApplied: insights.length,
      status: 'PROPOSAL_CREATED',
    };
  }

  /**
   * Get privacy budget usage report for the org.
   */
  async getPrivacyReport(orgId: string) {
    const settings = await this.getOrCreateSettings(orgId);

    const contributionStats = await this.prisma.federationContribution.aggregate({
      where: { orgId, status: FederationContributionStatus.ACTIVE },
      _count: { id: true },
      _sum: { recordCount: true },
    });

    const queriesExecuted = Math.round(
      computePrivacyBudget(1, settings.budgetUsed) / Math.max(settings.budgetUsed, 0.01),
    );

    return {
      orgId,
      budgetTotal: settings.privacyBudget,
      budgetUsed: settings.budgetUsed,
      budgetRemaining: Math.max(0, settings.privacyBudget - settings.budgetUsed),
      contributionCount: contributionStats._count.id,
      totalRecordsShared: contributionStats._sum.recordCount ?? 0,
      queriesExecuted: isFinite(queriesExecuted) ? queriesExecuted : 0,
      optedIn: settings.optedIn,
      domains: settings.domains,
    };
  }

  /**
   * Opt the org into federation.
   */
  async optIn(orgId: string, userId: string, orgSlug: string, domains?: string[]) {
    const settings = await this.getOrCreateSettings(orgId);

    const updated = await this.prisma.federationSettings.update({
      where: { orgId },
      data: {
        optedIn: true,
        ...(domains ? { domains } : {}),
      },
    });

    await createAuditEntry(this.tenantManager, orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.FEDERATION_OPT_IN,
      details: { domains: updated.domains },
    });

    return updated;
  }

  /**
   * Opt the org out of federation.
   */
  async optOut(orgId: string, userId: string, orgSlug: string) {
    await this.getOrCreateSettings(orgId);

    const updated = await this.prisma.federationSettings.update({
      where: { orgId },
      data: { optedIn: false },
    });

    await createAuditEntry(this.tenantManager, orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.FEDERATION_OPT_OUT,
      details: {},
    });

    return updated;
  }

  /**
   * Get anonymized contribution leaderboard by domain.
   */
  async getLeaderboard(domain?: string) {
    const where: Record<string, unknown> = {
      status: FederationContributionStatus.ACTIVE,
    };
    if (domain) {
      where.domain = domain;
    }

    // Group contributions by orgId (we'll hash the orgId for anonymity)
    const contributions = await this.prisma.federationContribution.groupBy({
      by: ['orgId'],
      where,
      _count: { id: true },
      _sum: { recordCount: true },
      orderBy: { _sum: { recordCount: 'desc' } },
      take: 20,
    });

    // Also get the domains for each org
    const orgDomains = await this.prisma.federationContribution.groupBy({
      by: ['orgId', 'domain'],
      where,
    });

    const domainMap = new Map<string, Set<string>>();
    for (const row of orgDomains) {
      const existing = domainMap.get(row.orgId) ?? new Set();
      existing.add(row.domain);
      domainMap.set(row.orgId, existing);
    }

    return contributions.map((row, index) => ({
      rank: index + 1,
      orgHash: createHash('sha256').update(row.orgId).digest('hex').slice(0, 12),
      contributionCount: row._count.id,
      totalRecords: row._sum.recordCount ?? 0,
      domains: Array.from(domainMap.get(row.orgId) ?? []),
    }));
  }

  // --- Internal helpers ---

  private async getOrCreateSettings(orgId: string) {
    let settings = await this.prisma.federationSettings.findUnique({
      where: { orgId },
    });

    if (!settings) {
      settings = await this.prisma.federationSettings.create({
        data: {
          orgId,
          optedIn: false,
          privacyBudget: 10.0,
          budgetUsed: 0.0,
          domains: [],
        },
      });
    }

    return settings;
  }
}
