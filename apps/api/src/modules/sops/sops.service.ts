import type { PrismaClient } from '@prisma/client';
import type { CreateSOPInput, PaginatedResponse } from '@surrogate-os/shared';
import { AuditAction, SOPStatus } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { createHash } from 'node:crypto';

interface SOPRow {
  id: string;
  surrogate_id: string;
  version: number;
  status: string;
  title: string;
  description: string | null;
  graph: Record<string, unknown>;
  certified_by: string | null;
  hash: string;
  previous_version_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: bigint;
}

function mapSOPRow(row: SOPRow) {
  return {
    id: row.id,
    surrogateId: row.surrogate_id,
    version: row.version,
    status: row.status,
    title: row.title,
    description: row.description,
    graph: row.graph,
    certifiedBy: row.certified_by,
    hash: row.hash,
    previousVersionId: row.previous_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function computeSOPHash(graph: Record<string, unknown>, title: string, version: number): string {
  const data = JSON.stringify({ graph, title, version });
  return createHash('sha256').update(data).digest('hex');
}

// Valid SOP status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  [SOPStatus.DRAFT]: [SOPStatus.REVIEW],
  [SOPStatus.REVIEW]: [SOPStatus.CERTIFIED, SOPStatus.DRAFT],
  [SOPStatus.CERTIFIED]: [SOPStatus.DEPRECATED],
  [SOPStatus.DEPRECATED]: [],
};

export class SOPService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async listAll(
    tenant: TenantContext,
    pagination: PaginationParams,
    filters?: { surrogateId?: string; status?: string },
  ): Promise<PaginatedResponse<ReturnType<typeof mapSOPRow>>> {
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
      `SELECT COUNT(*) as count FROM sops ${where}`,
      params,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sops ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapSOPRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async listBySurrogate(
    tenant: TenantContext,
    surrogateId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<ReturnType<typeof mapSOPRow>>> {
    return this.listAll(tenant, pagination, { surrogateId });
  }

  async getById(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sops WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('SOP not found');
    }

    return mapSOPRow(rows[0]);
  }

  async create(
    tenant: TenantContext,
    input: CreateSOPInput,
    userId: string,
  ) {
    // Determine version number
    const maxVersionRows = await this.tenantManager.executeInTenant<{ max_version: number }[]>(
      tenant.orgSlug,
      `SELECT COALESCE(MAX(version), 0) as max_version FROM sops WHERE surrogate_id = $1::uuid`,
      [input.surrogateId],
    );
    const newVersion = (maxVersionRows[0]?.max_version ?? 0) + 1;

    const hash = computeSOPHash(input.graph as Record<string, unknown>, input.title, newVersion);

    const rows = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `INSERT INTO sops (surrogate_id, version, title, description, graph, hash, previous_version_id)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING *`,
      [
        input.surrogateId,
        newVersion,
        input.title,
        input.description,
        JSON.stringify(input.graph),
        hash,
        null,
      ],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: input.surrogateId,
      userId,
      action: AuditAction.SOP_CREATED,
      details: { sopId: rows[0].id, version: newVersion, title: input.title },
    });

    return mapSOPRow(rows[0]);
  }

  async createVersion(
    tenant: TenantContext,
    sopId: string,
    input: CreateSOPInput,
    userId: string,
  ) {
    let previousVersion: SOPRow | null = null;
    let newVersion = 1;

    const existingRows = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sops WHERE id = $1::uuid`,
      [sopId],
    );

    if (existingRows.length > 0) {
      previousVersion = existingRows[0];
      const maxVersionRows = await this.tenantManager.executeInTenant<{ max_version: number }[]>(
        tenant.orgSlug,
        `SELECT COALESCE(MAX(version), 0) as max_version FROM sops WHERE surrogate_id = $1::uuid`,
        [input.surrogateId],
      );
      newVersion = (maxVersionRows[0]?.max_version ?? 0) + 1;
    }

    const hash = computeSOPHash(input.graph as Record<string, unknown>, input.title, newVersion);

    const rows = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `INSERT INTO sops (surrogate_id, version, title, description, graph, hash, previous_version_id)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING *`,
      [
        input.surrogateId,
        newVersion,
        input.title,
        input.description,
        JSON.stringify(input.graph),
        hash,
        previousVersion?.id ?? null,
      ],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: input.surrogateId,
      userId,
      action: AuditAction.SOP_CREATED,
      details: { sopId: rows[0].id, version: newVersion, title: input.title },
    });

    return mapSOPRow(rows[0]);
  }

  async transitionStatus(
    tenant: TenantContext,
    sopId: string,
    newStatus: string,
    userId: string,
  ) {
    const sop = await this.getById(tenant, sopId);

    const allowed = VALID_TRANSITIONS[sop.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition SOP from ${sop.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    const setClauses: string[] = [`status = $1`, `updated_at = $2`];
    const params: unknown[] = [newStatus, new Date()];
    let paramIndex = 3;

    // Set certifiedBy when transitioning to CERTIFIED
    if (newStatus === SOPStatus.CERTIFIED) {
      setClauses.push(`certified_by = $${paramIndex++}`);
      params.push(userId);
    }

    params.push(sopId);

    const rows = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `UPDATE sops SET ${setClauses.join(', ')} WHERE id = $${paramIndex}::uuid RETURNING *`,
      params,
    );

    // Determine audit action
    let auditAction = AuditAction.SOP_UPDATED;
    if (newStatus === SOPStatus.CERTIFIED) auditAction = AuditAction.SOP_CERTIFIED;
    if (newStatus === SOPStatus.DEPRECATED) auditAction = AuditAction.SOP_DEPRECATED;

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: sop.surrogateId,
      userId,
      action: auditAction,
      details: { sopId, from: sop.status, to: newStatus },
    });

    return mapSOPRow(rows[0]);
  }

}
