import type { PrismaClient } from '@prisma/client';
import type { CreateSurrogateInput, UpdateSurrogateInput, PaginatedResponse } from '@surrogate-os/shared';
import { AuditAction, SurrogateStatus } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError } from '../../lib/errors.js';
import { computeAuditHash } from '../../lib/crypto.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';

interface SurrogateRow {
  id: string;
  role_title: string;
  domain: string;
  jurisdiction: string;
  status: string;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: bigint;
}

interface AuditRow {
  hash: string;
}

function mapSurrogateRow(row: SurrogateRow) {
  return {
    id: row.id,
    roleTitle: row.role_title,
    domain: row.domain,
    jurisdiction: row.jurisdiction,
    status: row.status,
    config: row.config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SurrogateService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async create(
    tenant: TenantContext,
    input: CreateSurrogateInput,
    userId: string,
  ) {
    const rows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `INSERT INTO surrogates (role_title, domain, jurisdiction, config)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [
        input.roleTitle,
        input.domain,
        input.jurisdiction,
        JSON.stringify(input.config ?? {}),
      ],
    );

    const surrogate = rows[0];

    // Create audit entry
    await this.createAuditEntry(tenant, {
      surrogateId: surrogate.id,
      userId,
      action: AuditAction.SURROGATE_CREATED,
      details: { input },
    });

    return mapSurrogateRow(surrogate);
  }

  async list(
    tenant: TenantContext,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<ReturnType<typeof mapSurrogateRow>>> {
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM surrogates WHERE status != 'ARCHIVED'`,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `SELECT * FROM surrogates
       WHERE status != 'ARCHIVED'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapSurrogateRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getById(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `SELECT * FROM surrogates WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Surrogate not found');
    }

    return mapSurrogateRow(rows[0]);
  }

  async update(
    tenant: TenantContext,
    id: string,
    input: UpdateSurrogateInput,
    userId: string,
  ) {
    // Verify the surrogate exists
    await this.getById(tenant, id);

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.roleTitle !== undefined) {
      setClauses.push(`role_title = $${paramIndex++}`);
      params.push(input.roleTitle);
    }
    if (input.domain !== undefined) {
      setClauses.push(`domain = $${paramIndex++}`);
      params.push(input.domain);
    }
    if (input.jurisdiction !== undefined) {
      setClauses.push(`jurisdiction = $${paramIndex++}`);
      params.push(input.jurisdiction);
    }
    if (input.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(input.status);
    }
    if (input.config !== undefined) {
      setClauses.push(`config = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(input.config));
    }

    setClauses.push(`updated_at = now()`);

    params.push(id);

    const rows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `UPDATE surrogates SET ${setClauses.join(', ')} WHERE id = $${paramIndex}::uuid RETURNING *`,
      params,
    );

    // Create audit entry
    await this.createAuditEntry(tenant, {
      surrogateId: id,
      userId,
      action: AuditAction.SURROGATE_UPDATED,
      details: { changes: input },
    });

    return mapSurrogateRow(rows[0]);
  }

  async delete(tenant: TenantContext, id: string, userId: string) {
    // Verify the surrogate exists
    await this.getById(tenant, id);

    // Soft delete: set status to ARCHIVED
    const rows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `UPDATE surrogates SET status = $1, updated_at = now() WHERE id = $2::uuid RETURNING *`,
      [SurrogateStatus.ARCHIVED, id],
    );

    // Create audit entry
    await this.createAuditEntry(tenant, {
      surrogateId: id,
      userId,
      action: AuditAction.SURROGATE_DELETED,
      details: {},
    });

    return mapSurrogateRow(rows[0]);
  }

  private async createAuditEntry(
    tenant: TenantContext,
    input: {
      surrogateId: string | null;
      userId: string;
      action: AuditAction;
      details: Record<string, unknown>;
    },
  ): Promise<void> {
    const now = new Date();

    // Get the last audit entry hash
    const lastEntries = await this.tenantManager.executeInTenant<AuditRow[]>(
      tenant.orgSlug,
      `SELECT hash FROM audit_entries ORDER BY created_at DESC LIMIT 1`,
    );

    const previousHash = lastEntries.length > 0 ? lastEntries[0].hash : null;
    const hash = computeAuditHash(previousHash, input.action, now, input.surrogateId);

    await this.tenantManager.executeInTenant(
      tenant.orgSlug,
      `INSERT INTO audit_entries (surrogate_id, user_id, action, details, previous_hash, hash, created_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7)`,
      [
        input.surrogateId,
        input.userId,
        input.action,
        JSON.stringify(input.details),
        previousHash,
        hash,
        now,
      ],
    );
  }
}
