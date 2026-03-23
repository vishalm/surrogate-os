import type { PrismaClient } from '@prisma/client';
import type { CreateAuditEntryInput, PaginatedResponse } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError } from '../../lib/errors.js';
import { computeAuditHash } from '../../lib/crypto.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';

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

function mapAuditRow(row: AuditRow) {
  return {
    id: row.id,
    surrogateId: row.surrogate_id,
    userId: row.user_id,
    action: row.action,
    details: row.details,
    rationale: row.rationale,
    confidence: row.confidence,
    humanAuthRequired: row.human_auth_required,
    humanAuthGrantedBy: row.human_auth_granted_by,
    previousHash: row.previous_hash,
    hash: row.hash,
    createdAt: row.created_at,
  };
}

export interface AuditFilters {
  surrogateId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  brokenAt?: string;
}

export class AuditService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async create(
    tenant: TenantContext,
    input: CreateAuditEntryInput,
    userId: string,
  ) {
    const now = new Date();

    // Get the last audit entry's hash for chaining
    const lastEntries = await this.tenantManager.executeInTenant<{ hash: string }[]>(
      tenant.orgSlug,
      `SELECT hash FROM audit_entries ORDER BY created_at DESC LIMIT 1`,
    );

    const previousHash = lastEntries.length > 0 ? lastEntries[0].hash : null;
    const hash = computeAuditHash(
      previousHash,
      input.action,
      now,
      input.surrogateId ?? null,
    );

    const rows = await this.tenantManager.executeInTenant<AuditRow[]>(
      tenant.orgSlug,
      `INSERT INTO audit_entries
         (surrogate_id, user_id, action, details, rationale, confidence,
          human_auth_required, previous_hash, hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.surrogateId ?? null,
        userId,
        input.action,
        JSON.stringify(input.details),
        input.rationale ?? null,
        input.confidence ?? null,
        input.humanAuthRequired,
        previousHash,
        hash,
        now,
      ],
    );

    return mapAuditRow(rows[0]);
  }

  async list(
    tenant: TenantContext,
    filters: AuditFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<ReturnType<typeof mapAuditRow>>> {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.surrogateId) {
      whereClauses.push(`surrogate_id = $${paramIndex++}`);
      params.push(filters.surrogateId);
    }
    if (filters.action) {
      whereClauses.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }
    if (filters.startDate) {
      whereClauses.push(`created_at >= $${paramIndex++}`);
      params.push(new Date(filters.startDate));
    }
    if (filters.endDate) {
      whereClauses.push(`created_at <= $${paramIndex++}`);
      params.push(new Date(filters.endDate));
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countParams = [...params];
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM audit_entries ${whereSQL}`,
      countParams,
    );
    const total = Number(countRows[0].count);

    // Data query
    const dataParams = [...params, pagination.take, pagination.skip];
    const rows = await this.tenantManager.executeInTenant<AuditRow[]>(
      tenant.orgSlug,
      `SELECT * FROM audit_entries ${whereSQL}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      dataParams,
    );

    return buildPaginatedResponse(
      rows.map(mapAuditRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async verifyChain(
    tenant: TenantContext,
    startId?: string,
    endId?: string,
  ): Promise<ChainVerificationResult> {
    // Build the query to get audit entries in chronological order
    let whereSQL = '';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (startId && endId) {
      // Get the date range from the start and end entries
      const startRows = await this.tenantManager.executeInTenant<AuditRow[]>(
        tenant.orgSlug,
        `SELECT * FROM audit_entries WHERE id = $1`,
        [startId],
      );
      const endRows = await this.tenantManager.executeInTenant<AuditRow[]>(
        tenant.orgSlug,
        `SELECT * FROM audit_entries WHERE id = $1`,
        [endId],
      );

      if (startRows.length === 0) throw new NotFoundError('Start audit entry not found');
      if (endRows.length === 0) throw new NotFoundError('End audit entry not found');

      whereSQL = `WHERE created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`;
      params.push(startRows[0].created_at, endRows[0].created_at);
    } else if (startId) {
      const startRows = await this.tenantManager.executeInTenant<AuditRow[]>(
        tenant.orgSlug,
        `SELECT * FROM audit_entries WHERE id = $1`,
        [startId],
      );
      if (startRows.length === 0) throw new NotFoundError('Start audit entry not found');

      whereSQL = `WHERE created_at >= $${paramIndex++}`;
      params.push(startRows[0].created_at);
    }

    const entries = await this.tenantManager.executeInTenant<AuditRow[]>(
      tenant.orgSlug,
      `SELECT * FROM audit_entries ${whereSQL} ORDER BY created_at ASC`,
      params,
    );

    if (entries.length === 0) {
      return { valid: true, totalEntries: 0 };
    }

    // Verify each entry's hash
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedPreviousHash = i === 0 ? entry.previous_hash : entries[i - 1].hash;
      const expectedHash = computeAuditHash(
        expectedPreviousHash,
        entry.action,
        entry.created_at,
        entry.surrogate_id,
      );

      if (entry.hash !== expectedHash) {
        return {
          valid: false,
          totalEntries: entries.length,
          brokenAt: entry.id,
        };
      }

      // Also verify the previous_hash pointer (for entries after the first)
      if (i > 0 && entry.previous_hash !== entries[i - 1].hash) {
        return {
          valid: false,
          totalEntries: entries.length,
          brokenAt: entry.id,
        };
      }
    }

    return { valid: true, totalEntries: entries.length };
  }
}
