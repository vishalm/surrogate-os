import type { PrismaClient } from '@prisma/client';
import type { CreateMemoryEntryInput, PaginatedResponse } from '@surrogate-os/shared';
import { AuditAction, MemoryType } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { createAuditEntry } from '../../lib/audit-helper.js';

interface MemoryEntryRow {
  id: string;
  surrogate_id: string;
  type: string;
  source: string;
  content: string;
  tags: string[];
  observation_count: number;
  first_observed_at: Date;
  last_observed_at: Date;
  expires_at: Date | null;
  promoted_at: Date | null;
  created_at: Date;
}

interface CountRow {
  count: bigint;
}

interface ContentGroup {
  content: string;
  cnt: bigint;
  min_first_observed: Date;
  total_observations: bigint;
}

function mapMemoryEntryRow(row: MemoryEntryRow) {
  return {
    id: row.id,
    surrogateId: row.surrogate_id,
    type: row.type,
    source: row.source,
    content: row.content,
    tags: row.tags,
    observationCount: row.observation_count,
    firstObservedAt: row.first_observed_at,
    lastObservedAt: row.last_observed_at,
    expiresAt: row.expires_at,
    promotedAt: row.promoted_at,
    createdAt: row.created_at,
  };
}

export class MemoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async createEntry(
    tenant: TenantContext,
    input: CreateMemoryEntryInput,
    userId: string,
  ) {
    const now = new Date();
    const rows = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
      tenant.orgSlug,
      `INSERT INTO memory_entries (surrogate_id, type, source, content, tags, observation_count, first_observed_at, last_observed_at, expires_at)
       VALUES ($1::uuid, $2, $3, $4, $5, 1, $6, $6, $7)
       RETURNING *`,
      [
        input.surrogateId,
        input.type,
        input.source,
        input.content,
        input.tags,
        now,
        input.expiresAt ? new Date(input.expiresAt) : null,
      ],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: input.surrogateId,
      userId,
      action: AuditAction.MEMORY_CREATED,
      details: { memoryId: rows[0].id, type: input.type, source: input.source },
    });

    return mapMemoryEntryRow(rows[0]);
  }

  async listEntries(
    tenant: TenantContext,
    filters: { surrogateId?: string; type?: string; tags?: string[] },
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<ReturnType<typeof mapMemoryEntryRow>>> {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.surrogateId) {
      whereClauses.push(`surrogate_id = $${paramIndex++}::uuid`);
      params.push(filters.surrogateId);
    }
    if (filters.type) {
      whereClauses.push(`type = $${paramIndex++}`);
      params.push(filters.type);
    }
    if (filters.tags && filters.tags.length > 0) {
      whereClauses.push(`tags && $${paramIndex++}`);
      params.push(filters.tags);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM memory_entries ${where}`,
      params,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
      tenant.orgSlug,
      `SELECT * FROM memory_entries ${where}
       ORDER BY last_observed_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapMemoryEntryRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getEntry(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
      tenant.orgSlug,
      `SELECT * FROM memory_entries WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Memory entry not found');
    }

    return mapMemoryEntryRow(rows[0]);
  }

  async promoteToLTM(tenant: TenantContext, id: string, userId: string) {
    const entry = await this.getEntry(tenant, id);

    if (entry.type !== MemoryType.STM) {
      throw new ValidationError('Only STM entries can be promoted to LTM');
    }

    const now = new Date();
    const rows = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
      tenant.orgSlug,
      `UPDATE memory_entries SET type = $1, promoted_at = $2
       WHERE id = $3::uuid
       RETURNING *`,
      [MemoryType.LTM, now, id],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: entry.surrogateId,
      userId,
      action: AuditAction.MEMORY_PROMOTED,
      details: { memoryId: id },
    });

    return mapMemoryEntryRow(rows[0]);
  }

  async archiveEntry(tenant: TenantContext, id: string, userId: string) {
    const entry = await this.getEntry(tenant, id);

    await this.tenantManager.executeInTenant(
      tenant.orgSlug,
      `DELETE FROM memory_entries WHERE id = $1::uuid`,
      [id],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: entry.surrogateId,
      userId,
      action: AuditAction.MEMORY_ARCHIVED,
      details: { memoryId: id, type: entry.type },
    });
  }

  async incrementObservation(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
      tenant.orgSlug,
      `UPDATE memory_entries
       SET observation_count = observation_count + 1, last_observed_at = $1
       WHERE id = $2::uuid
       RETURNING *`,
      [new Date(), id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Memory entry not found');
    }

    return mapMemoryEntryRow(rows[0]);
  }

  async detectPatterns(tenant: TenantContext, surrogateId: string, userId: string) {
    // Find all STM entries for the surrogate grouped by exact content with 3+ occurrences
    const groups = await this.tenantManager.executeInTenant<ContentGroup[]>(
      tenant.orgSlug,
      `SELECT content, COUNT(*) as cnt,
              MIN(first_observed_at) as min_first_observed,
              SUM(observation_count) as total_observations
       FROM memory_entries
       WHERE surrogate_id = $1::uuid AND type = $2
       GROUP BY content
       HAVING COUNT(*) >= 3`,
      [surrogateId, MemoryType.STM],
    );

    const promoted: ReturnType<typeof mapMemoryEntryRow>[] = [];

    for (const group of groups) {
      const now = new Date();

      // Get all STM entries with this content to collect tags
      const matchingRows = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
        tenant.orgSlug,
        `SELECT * FROM memory_entries
         WHERE surrogate_id = $1::uuid AND type = $2 AND content = $3`,
        [surrogateId, MemoryType.STM, group.content],
      );

      // Merge tags from all matching entries (deduplicated)
      const allTags = [...new Set(matchingRows.flatMap((r) => r.tags))];

      // Insert merged LTM entry
      const insertedRows = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
        tenant.orgSlug,
        `INSERT INTO memory_entries (surrogate_id, type, source, content, tags, observation_count, first_observed_at, last_observed_at, promoted_at)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          surrogateId,
          MemoryType.LTM,
          'PATTERN_DETECTION',
          group.content,
          allTags,
          Number(group.total_observations),
          group.min_first_observed,
          now,
          now,
        ],
      );

      // Delete the merged STM entries
      const idsToDelete = matchingRows.map((r) => r.id);
      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `DELETE FROM memory_entries
         WHERE id = ANY($1::uuid[])`,
        [idsToDelete],
      );

      await createAuditEntry(this.tenantManager, tenant.orgSlug, {
        surrogateId,
        userId,
        action: AuditAction.MEMORY_PROMOTED,
        details: {
          memoryId: insertedRows[0].id,
          mergedCount: Number(group.cnt),
          source: 'PATTERN_DETECTION',
        },
      });

      promoted.push(mapMemoryEntryRow(insertedRows[0]));
    }

    return { promoted, patternsDetected: groups.length };
  }

  async getRelevantMemories(
    tenant: TenantContext,
    surrogateId: string,
    type?: string,
  ) {
    const whereClauses: string[] = ['surrogate_id = $1::uuid'];
    const params: unknown[] = [surrogateId];
    let paramIndex = 2;

    if (type) {
      whereClauses.push(`type = $${paramIndex++}`);
      params.push(type);
    }

    const where = whereClauses.join(' AND ');

    const rows = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
      tenant.orgSlug,
      `SELECT * FROM memory_entries WHERE ${where}
       ORDER BY last_observed_at DESC
       LIMIT 20`,
      params,
    );

    return rows.map(mapMemoryEntryRow);
  }

  async cleanupExpiredSTM(tenant: TenantContext) {
    const result = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
      tenant.orgSlug,
      `DELETE FROM memory_entries
       WHERE type = $1 AND expires_at < $2
       RETURNING *`,
      [MemoryType.STM, new Date()],
    );

    return { deletedCount: result.length };
  }

}
