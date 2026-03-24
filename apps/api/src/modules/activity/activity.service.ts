import type { PrismaClient } from '@prisma/client';
import type { PaginatedResponse } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';

// ── Row types ──────────────────────────────────────────────

interface AuditRow {
  id: string;
  surrogate_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  rationale: string | null;
  confidence: number | null;
  human_auth_required: boolean;
  human_auth_granted_by: string | null;
  previous_hash: string | null;
  hash: string;
  created_at: Date;
}

interface CountRow {
  count: bigint;
}

interface ActionCountRow {
  action: string;
  count: bigint;
}

interface SurrogateSearchRow {
  id: string;
  role_title: string;
  domain: string;
}

interface SOPSearchRow {
  id: string;
  title: string;
  description: string | null;
  surrogate_id: string;
}

interface MemorySearchRow {
  id: string;
  content: string;
  surrogate_id: string;
  type: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
}

interface SurrogateNameRow {
  id: string;
  role_title: string;
}

// ── Mapped types ───────────────────────────────────────────

interface ActivityFeedItem {
  id: string;
  surrogateId: string | null;
  userId: string | null;
  action: string;
  details: Record<string, unknown>;
  description: string;
  actorName: string | null;
  createdAt: Date;
}

interface ActivityStats {
  period: string;
  totalActions: number;
  actionCounts: Record<string, number>;
  mostActiveSurrogate: { id: string; name: string; count: number } | null;
}

interface SearchResult {
  entityType: 'surrogate' | 'sop' | 'memory';
  id: string;
  title: string;
  subtitle: string | null;
}

// ── Filters ────────────────────────────────────────────────

export interface ActivityFeedFilters {
  userId?: string;
  surrogateId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

// ── Human-readable action descriptions ─────────────────────

const ACTION_DESCRIPTIONS: Record<string, string> = {
  SURROGATE_CREATED: 'created a new surrogate',
  SURROGATE_UPDATED: 'updated a surrogate',
  SURROGATE_DELETED: 'archived a surrogate',
  SOP_CREATED: 'created a new SOP',
  SOP_UPDATED: 'updated an SOP',
  SOP_CERTIFIED: 'certified an SOP',
  SOP_DEPRECATED: 'deprecated an SOP',
  USER_LOGIN: 'logged in',
  USER_REGISTERED: 'registered an account',
  ORG_UPDATED: 'updated organization settings',
  MEMBER_INVITED: 'invited a new member',
  MEMBER_REMOVED: 'removed a member',
  ESCALATION_TRIGGERED: 'triggered an escalation',
  DECISION_MADE: 'made a decision',
  OVERRIDE_APPLIED: 'applied an override',
  SESSION_STARTED: 'started a session',
  SESSION_COMPLETED: 'completed a session',
  DEBRIEF_GENERATED: 'generated a debrief',
  SOP_PROPOSAL_CREATED: 'created an SOP proposal',
  SOP_PROPOSAL_APPROVED: 'approved an SOP proposal',
  SOP_PROPOSAL_REJECTED: 'rejected an SOP proposal',
  DOCUMENT_UPLOADED: 'uploaded a document',
  DOCUMENT_PROCESSED: 'processed a document',
  MEMORY_CREATED: 'created a memory entry',
  MEMORY_PROMOTED: 'promoted memory to LTM',
  MEMORY_ARCHIVED: 'archived a memory entry',
  HANDOFF_INITIATED: 'initiated a handoff',
  HANDOFF_ACCEPTED: 'accepted a handoff',
  HANDOFF_REJECTED: 'rejected a handoff',
  PERSONA_TEMPLATE_CREATED: 'created a persona template',
  PERSONA_TEMPLATE_UPDATED: 'updated a persona template',
  PERSONA_TEMPLATE_DELETED: 'deleted a persona template',
  MARKETPLACE_LISTING_PUBLISHED: 'published a marketplace listing',
  MARKETPLACE_SOP_INSTALLED: 'installed an SOP from marketplace',
  BIAS_CHECK_TRIGGERED: 'triggered a bias check',
  BIAS_CHECK_COMPLETED: 'completed a bias check',
  FEDERATION_CONTRIBUTION_CREATED: 'created a federation contribution',
  FEDERATION_INSIGHTS_APPLIED: 'applied federation insights',
  FEDERATION_OPT_IN: 'opted in to federation',
  FEDERATION_OPT_OUT: 'opted out of federation',
  HUMANOID_DEVICE_REGISTERED: 'registered a humanoid device',
  HUMANOID_DEVICE_STATUS_CHANGED: 'changed humanoid device status',
  HUMANOID_KILL_SWITCH_TRIGGERED: 'triggered humanoid kill switch',
  COMPLIANCE_CHECK_RUN: 'ran a compliance check',
  SOP_SIGNED: 'signed an SOP',
  SOP_SIGNATURE_VERIFIED: 'verified SOP signature',
  COMPLIANCE_REPORT_GENERATED: 'generated a compliance report',
};

function describeAction(action: string): string {
  return ACTION_DESCRIPTIONS[action] ?? action.replace(/_/g, ' ').toLowerCase();
}

// ── Service ────────────────────────────────────────────────

export class ActivityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  /**
   * Paginated activity feed sourced from audit_entries, enriched with
   * human-readable descriptions and actor names.
   */
  async getActivityFeed(
    tenant: TenantContext,
    pagination: PaginationParams,
    filters?: ActivityFeedFilters,
  ): Promise<PaginatedResponse<ActivityFeedItem>> {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.userId) {
      whereClauses.push(`a.user_id = $${paramIndex++}::uuid`);
      params.push(filters.userId);
    }
    if (filters?.surrogateId) {
      whereClauses.push(`a.surrogate_id = $${paramIndex++}::uuid`);
      params.push(filters.surrogateId);
    }
    if (filters?.action) {
      whereClauses.push(`a.action = $${paramIndex++}`);
      params.push(filters.action);
    }
    if (filters?.startDate) {
      whereClauses.push(`a.created_at >= $${paramIndex++}`);
      params.push(new Date(filters.startDate));
    }
    if (filters?.endDate) {
      whereClauses.push(`a.created_at <= $${paramIndex++}`);
      params.push(new Date(filters.endDate));
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM audit_entries a ${whereSQL}`,
      [...params],
    );
    const total = Number(countRows[0].count);

    // Data
    const dataParams = [...params, pagination.take, pagination.skip];
    const rows = await this.tenantManager.executeInTenant<AuditRow[]>(
      tenant.orgSlug,
      `SELECT * FROM audit_entries a ${whereSQL}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      dataParams,
    );

    // Batch-fetch user names for the returned rows
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const userMap = await this.getUserNameMap(tenant, userIds);

    const items: ActivityFeedItem[] = rows.map((row) => ({
      id: row.id,
      surrogateId: row.surrogate_id,
      userId: row.user_id,
      action: row.action,
      details: row.details,
      description: describeAction(row.action),
      actorName: row.user_id ? (userMap.get(row.user_id) ?? null) : null,
      createdAt: row.created_at,
    }));

    return buildPaginatedResponse(items, total, pagination.page, pagination.pageSize);
  }

  /**
   * Activity counts grouped by action type for a given period.
   * period: 'today' | 'week' | 'month'
   */
  async getActivityStats(
    tenant: TenantContext,
    period: string,
  ): Promise<ActivityStats> {
    const cutoff = this.periodToCutoff(period);

    // Action counts
    const actionRows = await this.tenantManager.executeInTenant<ActionCountRow[]>(
      tenant.orgSlug,
      `SELECT action, COUNT(*) as count
       FROM audit_entries
       WHERE created_at >= $1
       GROUP BY action
       ORDER BY count DESC`,
      [cutoff],
    );

    const actionCounts: Record<string, number> = {};
    let totalActions = 0;
    for (const row of actionRows) {
      const c = Number(row.count);
      actionCounts[row.action] = c;
      totalActions += c;
    }

    // Most active surrogate
    const surrogateRows = await this.tenantManager.executeInTenant<
      { surrogate_id: string; count: bigint }[]
    >(
      tenant.orgSlug,
      `SELECT surrogate_id, COUNT(*) as count
       FROM audit_entries
       WHERE created_at >= $1 AND surrogate_id IS NOT NULL
       GROUP BY surrogate_id
       ORDER BY count DESC
       LIMIT 1`,
      [cutoff],
    );

    let mostActiveSurrogate: ActivityStats['mostActiveSurrogate'] = null;
    if (surrogateRows.length > 0) {
      const nameRows = await this.tenantManager.executeInTenant<SurrogateNameRow[]>(
        tenant.orgSlug,
        `SELECT id, role_title FROM surrogates WHERE id = $1::uuid`,
        [surrogateRows[0].surrogate_id],
      );
      if (nameRows.length > 0) {
        mostActiveSurrogate = {
          id: nameRows[0].id,
          name: nameRows[0].role_title,
          count: Number(surrogateRows[0].count),
        };
      }
    }

    return { period, totalActions, actionCounts, mostActiveSurrogate };
  }

  /**
   * Full-text search across surrogates, SOPs, and memory entries.
   * Returns mixed results with entity-type labels.
   */
  async searchGlobal(
    tenant: TenantContext,
    query: string,
    entityTypes?: string[],
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const pattern = `%${query}%`;
    const typesSet = entityTypes
      ? new Set(entityTypes.map((t) => t.toLowerCase()))
      : null;

    // Search surrogates
    if (!typesSet || typesSet.has('surrogate') || typesSet.has('surrogates')) {
      const surrogateRows = await this.tenantManager.executeInTenant<SurrogateSearchRow[]>(
        tenant.orgSlug,
        `SELECT id, role_title, domain FROM surrogates
         WHERE (role_title ILIKE $1 OR domain ILIKE $1)
           AND status != 'ARCHIVED'
         ORDER BY created_at DESC
         LIMIT 10`,
        [pattern],
      );
      for (const row of surrogateRows) {
        results.push({
          entityType: 'surrogate',
          id: row.id,
          title: row.role_title,
          subtitle: row.domain,
        });
      }
    }

    // Search SOPs
    if (!typesSet || typesSet.has('sop') || typesSet.has('sops')) {
      const sopRows = await this.tenantManager.executeInTenant<SOPSearchRow[]>(
        tenant.orgSlug,
        `SELECT id, title, description, surrogate_id FROM sops
         WHERE (title ILIKE $1 OR description ILIKE $1)
         ORDER BY created_at DESC
         LIMIT 10`,
        [pattern],
      );
      for (const row of sopRows) {
        results.push({
          entityType: 'sop',
          id: row.id,
          title: row.title,
          subtitle: row.description,
        });
      }
    }

    // Search memory entries
    if (!typesSet || typesSet.has('memory')) {
      const memoryRows = await this.tenantManager.executeInTenant<MemorySearchRow[]>(
        tenant.orgSlug,
        `SELECT id, content, surrogate_id, type FROM memory_entries
         WHERE content ILIKE $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [pattern],
      );
      for (const row of memoryRows) {
        results.push({
          entityType: 'memory',
          id: row.id,
          title: row.content.length > 80 ? row.content.slice(0, 80) + '...' : row.content,
          subtitle: `${row.type} memory`,
        });
      }
    }

    return results;
  }

  // ── Private helpers ────────────────────────────────────────

  private async getUserNameMap(
    tenant: TenantContext,
    userIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (userIds.length === 0) return map;

    // Build $1::uuid, $2::uuid, ... placeholders
    const placeholders = userIds.map((_, i) => `$${i + 1}::uuid`).join(', ');
    const rows = await this.tenantManager.executeInTenant<UserRow[]>(
      tenant.orgSlug,
      `SELECT id, name, email FROM users WHERE id IN (${placeholders})`,
      userIds,
    );

    for (const row of rows) {
      map.set(row.id, row.name || row.email);
    }
    return map;
  }

  private periodToCutoff(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'today': {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return d;
      }
      case 'month': {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        return d;
      }
      default: {
        // Fallback to 7 days
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return d;
      }
    }
  }
}
