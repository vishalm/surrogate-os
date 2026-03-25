import type { PrismaClient } from '@prisma/client';
import type {
  CreatePersonaTemplateInput,
  UpdatePersonaTemplateInput,
  PaginatedResponse,
} from '@surrogate-os/shared';
import { AuditAction, PersonaTemplateStatus } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError } from '../../lib/errors.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';

interface PersonaTemplateRow {
  id: string;
  name: string;
  description: string | null;
  domain: string;
  jurisdiction: string;
  base_config: Record<string, unknown>;
  tags: string[];
  category: string | null;
  status: string;
  current_version: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface PersonaVersionRow {
  id: string;
  template_id: string;
  version: string;
  config: Record<string, unknown>;
  changelog: string | null;
  created_by: string;
  created_at: Date;
}

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

function mapTemplateRow(row: PersonaTemplateRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    domain: row.domain,
    jurisdiction: row.jurisdiction,
    baseConfig: row.base_config,
    tags: row.tags,
    category: row.category,
    status: row.status,
    currentVersion: row.current_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersionRow(row: PersonaVersionRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    version: row.version,
    config: row.config,
    changelog: row.changelog,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
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

/**
 * Bumps the patch version of a semver string (e.g. "1.0.0" -> "1.0.1").
 */
function bumpPatchVersion(version: string): string {
  const parts = version.split('.');
  if (parts.length !== 3) return '1.0.1';
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10);
  return `${major}.${minor}.${patch + 1}`;
}

export interface PersonaListFilters {
  domain?: string;
  category?: string;
  tags?: string[];
  status?: string;
}

export class PersonaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async create(
    tenant: TenantContext,
    input: CreatePersonaTemplateInput,
    userId: string,
  ) {
    const initialVersion = '1.0.0';
    const baseConfig = input.baseConfig ?? {};

    const rows = await this.tenantManager.executeInTenant<PersonaTemplateRow[]>(
      tenant.orgSlug,
      `INSERT INTO persona_templates (name, description, domain, jurisdiction, base_config, tags, category, status, current_version, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::text[], $7, $8, $9, $10::uuid)
       RETURNING *`,
      [
        input.name,
        input.description ?? null,
        input.domain,
        input.jurisdiction,
        JSON.stringify(baseConfig),
        input.tags ?? [],
        input.category ?? null,
        PersonaTemplateStatus.DRAFT,
        initialVersion,
        userId,
      ],
    );

    const template = rows[0];

    // Insert initial persona_version
    await this.tenantManager.executeInTenant<PersonaVersionRow[]>(
      tenant.orgSlug,
      `INSERT INTO persona_versions (template_id, version, config, changelog, created_by)
       VALUES ($1::uuid, $2, $3::jsonb, $4, $5::uuid)
       RETURNING *`,
      [
        template.id,
        initialVersion,
        JSON.stringify(baseConfig),
        'Initial version',
        userId,
      ],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.PERSONA_TEMPLATE_CREATED,
      details: { templateId: template.id, input },
    });

    return mapTemplateRow(template);
  }

  async list(
    tenant: TenantContext,
    pagination: PaginationParams,
    filters: PersonaListFilters,
  ): Promise<PaginatedResponse<ReturnType<typeof mapTemplateRow>>> {
    const whereClauses: string[] = [`status != 'ARCHIVED'`];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.domain) {
      whereClauses.push(`domain = $${paramIndex++}`);
      params.push(filters.domain);
    }
    if (filters.category) {
      whereClauses.push(`category = $${paramIndex++}`);
      params.push(filters.category);
    }
    if (filters.tags && filters.tags.length > 0) {
      whereClauses.push(`tags && $${paramIndex++}::text[]`);
      params.push(filters.tags);
    }
    if (filters.status) {
      // Override the default exclusion of ARCHIVED if explicitly filtering by status
      whereClauses.length = 0;
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const countParams = [...params];
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM persona_templates ${whereClause}`,
      countParams,
    );
    const total = Number(countRows[0].count);

    const listParams = [...params, pagination.take, pagination.skip];
    const rows = await this.tenantManager.executeInTenant<PersonaTemplateRow[]>(
      tenant.orgSlug,
      `SELECT * FROM persona_templates ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      listParams,
    );

    return buildPaginatedResponse(
      rows.map(mapTemplateRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getById(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<PersonaTemplateRow[]>(
      tenant.orgSlug,
      `SELECT * FROM persona_templates WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Persona template not found');
    }

    const template = mapTemplateRow(rows[0]);

    // Fetch version history
    const versionRows = await this.tenantManager.executeInTenant<PersonaVersionRow[]>(
      tenant.orgSlug,
      `SELECT * FROM persona_versions WHERE template_id = $1::uuid ORDER BY created_at DESC`,
      [id],
    );

    return {
      ...template,
      versions: versionRows.map(mapVersionRow),
    };
  }

  async update(
    tenant: TenantContext,
    id: string,
    input: UpdatePersonaTemplateInput,
    userId: string,
  ) {
    // Verify template exists
    const existing = await this.getById(tenant, id);

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    let baseConfigChanged = false;

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }
    if (input.domain !== undefined) {
      setClauses.push(`domain = $${paramIndex++}`);
      params.push(input.domain);
    }
    if (input.jurisdiction !== undefined) {
      setClauses.push(`jurisdiction = $${paramIndex++}`);
      params.push(input.jurisdiction);
    }
    if (input.tags !== undefined) {
      setClauses.push(`tags = $${paramIndex++}::text[]`);
      params.push(input.tags);
    }
    if (input.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      params.push(input.category);
    }
    if (input.baseConfig !== undefined) {
      baseConfigChanged = true;
      setClauses.push(`base_config = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(input.baseConfig));
    }

    // If baseConfig changed, bump version
    let newVersion = existing.currentVersion;
    if (baseConfigChanged) {
      newVersion = bumpPatchVersion(existing.currentVersion);
      setClauses.push(`current_version = $${paramIndex++}`);
      params.push(newVersion);
    }

    setClauses.push(`updated_at = now()`);
    params.push(id);

    const rows = await this.tenantManager.executeInTenant<PersonaTemplateRow[]>(
      tenant.orgSlug,
      `UPDATE persona_templates SET ${setClauses.join(', ')} WHERE id = $${paramIndex}::uuid RETURNING *`,
      params,
    );

    // If baseConfig changed, insert new persona_version
    if (baseConfigChanged && input.baseConfig !== undefined) {
      await this.tenantManager.executeInTenant<PersonaVersionRow[]>(
        tenant.orgSlug,
        `INSERT INTO persona_versions (template_id, version, config, changelog, created_by)
         VALUES ($1::uuid, $2, $3::jsonb, $4, $5::uuid)
         RETURNING *`,
        [
          id,
          newVersion,
          JSON.stringify(input.baseConfig),
          `Config updated to version ${newVersion}`,
          userId,
        ],
      );
    }

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.PERSONA_TEMPLATE_UPDATED,
      details: { templateId: id, changes: input, newVersion },
    });

    return mapTemplateRow(rows[0]);
  }

  async rollback(
    tenant: TenantContext,
    id: string,
    targetVersion: string,
    userId: string,
  ) {
    // Verify template exists
    await this.getById(tenant, id);

    // Find the target version
    const versionRows = await this.tenantManager.executeInTenant<PersonaVersionRow[]>(
      tenant.orgSlug,
      `SELECT * FROM persona_versions WHERE template_id = $1::uuid AND version = $2`,
      [id, targetVersion],
    );

    if (versionRows.length === 0) {
      throw new NotFoundError(`Persona version ${targetVersion} not found`);
    }

    const targetVersionRow = versionRows[0];

    // Update template's base_config and current_version
    const rows = await this.tenantManager.executeInTenant<PersonaTemplateRow[]>(
      tenant.orgSlug,
      `UPDATE persona_templates
       SET base_config = $1::jsonb, current_version = $2, updated_at = now()
       WHERE id = $3::uuid
       RETURNING *`,
      [JSON.stringify(targetVersionRow.config), targetVersion, id],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.PERSONA_TEMPLATE_UPDATED,
      details: { templateId: id, action: 'rollback', targetVersion },
    });

    return mapTemplateRow(rows[0]);
  }

  async instantiate(
    tenant: TenantContext,
    id: string,
    userId: string,
  ) {
    const template = await this.getById(tenant, id);

    // Insert into surrogates table using template's base_config
    const rows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `INSERT INTO surrogates (role_title, domain, jurisdiction, config)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [
        template.name,
        template.domain,
        template.jurisdiction,
        JSON.stringify(template.baseConfig),
      ],
    );

    const surrogate = rows[0];

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: surrogate.id,
      userId,
      action: AuditAction.SURROGATE_CREATED,
      details: { fromTemplate: id, templateVersion: template.currentVersion },
    });

    return mapSurrogateRow(surrogate);
  }

  async exportTemplate(tenant: TenantContext, id: string) {
    const template = await this.getById(tenant, id);
    return {
      template: {
        name: template.name,
        description: template.description,
        domain: template.domain,
        jurisdiction: template.jurisdiction,
        baseConfig: template.baseConfig,
        tags: template.tags,
        category: template.category,
        status: template.status,
        currentVersion: template.currentVersion,
      },
      versions: template.versions,
    };
  }

  async importTemplate(
    tenant: TenantContext,
    data: {
      template: {
        name: string;
        description?: string | null;
        domain: string;
        jurisdiction: string;
        baseConfig?: Record<string, unknown>;
        tags?: string[];
        category?: string | null;
        status?: string;
        currentVersion?: string;
      };
      versions: Array<{
        version: string;
        config: Record<string, unknown>;
        changelog?: string | null;
        createdBy?: string;
      }>;
    },
    userId: string,
  ) {
    const t = data.template;
    const currentVersion = t.currentVersion ?? '1.0.0';

    const rows = await this.tenantManager.executeInTenant<PersonaTemplateRow[]>(
      tenant.orgSlug,
      `INSERT INTO persona_templates (name, description, domain, jurisdiction, base_config, tags, category, status, current_version, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::text[], $7, $8, $9, $10::uuid)
       RETURNING *`,
      [
        t.name,
        t.description ?? null,
        t.domain,
        t.jurisdiction,
        JSON.stringify(t.baseConfig ?? {}),
        t.tags ?? [],
        t.category ?? null,
        PersonaTemplateStatus.DRAFT,
        currentVersion,
        userId,
      ],
    );

    const template = rows[0];

    // Insert all versions
    for (const v of data.versions) {
      await this.tenantManager.executeInTenant<PersonaVersionRow[]>(
        tenant.orgSlug,
        `INSERT INTO persona_versions (template_id, version, config, changelog, created_by)
         VALUES ($1::uuid, $2, $3::jsonb, $4, $5::uuid)
         RETURNING *`,
        [
          template.id,
          v.version,
          JSON.stringify(v.config),
          v.changelog ?? null,
          userId,
        ],
      );
    }

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.PERSONA_TEMPLATE_CREATED,
      details: { templateId: template.id, action: 'import', versionCount: data.versions.length },
    });

    return mapTemplateRow(template);
  }

  async delete(tenant: TenantContext, id: string, userId: string) {
    // Verify template exists
    await this.getById(tenant, id);

    const rows = await this.tenantManager.executeInTenant<PersonaTemplateRow[]>(
      tenant.orgSlug,
      `UPDATE persona_templates SET status = $1, updated_at = now() WHERE id = $2::uuid RETURNING *`,
      [PersonaTemplateStatus.ARCHIVED, id],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.PERSONA_TEMPLATE_DELETED,
      details: { templateId: id },
    });

    return mapTemplateRow(rows[0]);
  }

}
