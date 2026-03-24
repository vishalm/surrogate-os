import type { PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { AuditAction } from '@surrogate-os/shared';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

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

interface OrgDocumentRow {
  id: string;
  title: string;
  mime_type: string;
  status: string;
  chunk_count: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface ComplianceCheckRow {
  id: string;
  surrogate_id: string;
  framework_id: string;
  status: string;
  results: unknown;
  passed: number;
  failed: number;
  score: number | null;
  report: unknown;
  checked_by: string | null;
  created_at: Date;
}

interface AuditEntryRow {
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

interface SessionRow {
  id: string;
  surrogate_id: string;
  status: string;
  metadata: Record<string, unknown>;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}

interface ExportHistoryRow {
  id: string;
  type: string;
  status: string;
  record_count: number;
  file_size_bytes: bigint | null;
  options: Record<string, unknown>;
  exported_by: string;
  created_at: Date;
}

interface CountRow {
  count: bigint;
}

// ---------------------------------------------------------------------------
// Export options
// ---------------------------------------------------------------------------

export interface ExportOrgOptions {
  includeAudit?: boolean;
  includeMemory?: boolean;
  dateRange?: { start: string; end: string };
}

// ---------------------------------------------------------------------------
// Export data shapes
// ---------------------------------------------------------------------------

interface OrgExportData {
  exportVersion: string;
  exportedAt: string;
  type: 'ORG_EXPORT';
  surrogates: unknown[];
  sops: unknown[];
  personaTemplates: unknown[];
  memoryEntries?: unknown[];
  orgDocuments: unknown[];
  complianceChecks: unknown[];
  auditLog?: unknown[];
}

interface SurrogateExportData {
  exportVersion: string;
  exportedAt: string;
  type: 'SURROGATE_EXPORT';
  surrogate: unknown;
  sops: unknown[];
  memoryEntries: unknown[];
  sessions: unknown[];
}

interface SOPExportData {
  exportVersion: string;
  exportedAt: string;
  type: 'SOP_EXPORT';
  sops: unknown[];
}

// ---------------------------------------------------------------------------
// Import data shapes for validation
// ---------------------------------------------------------------------------

interface OrgImportData {
  exportVersion: string;
  type: 'ORG_EXPORT';
  surrogates?: Array<{
    roleTitle: string;
    domain: string;
    jurisdiction: string;
    status?: string;
    config?: Record<string, unknown>;
  }>;
  sops?: Array<{
    surrogateIndex?: number;
    surrogateId?: string;
    version?: number;
    status?: string;
    title: string;
    description?: string | null;
    graph: Record<string, unknown>;
    hash: string;
  }>;
  personaTemplates?: Array<{
    name: string;
    description?: string | null;
    domain: string;
    jurisdiction: string;
    baseConfig?: Record<string, unknown>;
    tags?: string[];
    category?: string | null;
    currentVersion?: string;
    versions?: Array<{
      version: string;
      config: Record<string, unknown>;
      changelog?: string | null;
    }>;
  }>;
  memoryEntries?: Array<{
    surrogateIndex?: number;
    surrogateId?: string;
    type: string;
    source: string;
    content: string;
    tags?: string[];
    observationCount?: number;
  }>;
  orgDocuments?: Array<{
    title: string;
    mimeType?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface SOPImportData {
  exportVersion: string;
  type: 'SOP_EXPORT';
  sops: Array<{
    title: string;
    description?: string | null;
    graph: Record<string, unknown>;
    hash: string;
    version?: number;
    status?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapExportHistoryRow(row: ExportHistoryRow) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    recordCount: row.record_count,
    fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : null,
    options: row.options,
    exportedBy: row.exported_by,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const EXPORT_VERSION = '1.0.0';

export class ExportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  // =========================================================================
  // Export Org
  // =========================================================================

  async exportOrg(
    tenant: TenantContext,
    options: ExportOrgOptions,
    userId: string,
  ): Promise<OrgExportData> {
    const dateFilter = this.buildDateFilter(options.dateRange);

    // Surrogates
    const surrogates = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `SELECT * FROM surrogates ${dateFilter.where} ORDER BY created_at ASC`,
      dateFilter.params,
    );

    // SOPs
    const sops = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sops ${dateFilter.where} ORDER BY created_at ASC`,
      dateFilter.params,
    );

    // Persona templates + versions
    const templates = await this.tenantManager.executeInTenant<PersonaTemplateRow[]>(
      tenant.orgSlug,
      `SELECT * FROM persona_templates ${dateFilter.where} ORDER BY created_at ASC`,
      dateFilter.params,
    );

    const templateVersions = await this.tenantManager.executeInTenant<PersonaVersionRow[]>(
      tenant.orgSlug,
      `SELECT * FROM persona_versions ORDER BY created_at ASC`,
    );

    const personaTemplatesExport = templates.map((t) => ({
      name: t.name,
      description: t.description,
      domain: t.domain,
      jurisdiction: t.jurisdiction,
      baseConfig: t.base_config,
      tags: t.tags,
      category: t.category,
      status: t.status,
      currentVersion: t.current_version,
      versions: templateVersions
        .filter((v) => v.template_id === t.id)
        .map((v) => ({
          version: v.version,
          config: v.config,
          changelog: v.changelog,
          createdBy: v.created_by,
          createdAt: v.created_at,
        })),
    }));

    // Org DNA documents
    const orgDocuments = await this.tenantManager.executeInTenant<OrgDocumentRow[]>(
      tenant.orgSlug,
      `SELECT * FROM org_documents ${dateFilter.where} ORDER BY created_at ASC`,
      dateFilter.params,
    );

    // Compliance checks
    const complianceChecks = await this.tenantManager.executeInTenant<ComplianceCheckRow[]>(
      tenant.orgSlug,
      `SELECT * FROM compliance_checks ${dateFilter.where} ORDER BY created_at ASC`,
      dateFilter.params,
    );

    const exportData: OrgExportData = {
      exportVersion: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      type: 'ORG_EXPORT',
      surrogates: surrogates.map((s) => ({
        roleTitle: s.role_title,
        domain: s.domain,
        jurisdiction: s.jurisdiction,
        status: s.status,
        config: s.config,
        createdAt: s.created_at,
      })),
      sops: sops.map((s) => ({
        surrogateId: s.surrogate_id,
        version: s.version,
        status: s.status,
        title: s.title,
        description: s.description,
        graph: s.graph,
        certifiedBy: s.certified_by,
        hash: s.hash,
        createdAt: s.created_at,
      })),
      personaTemplates: personaTemplatesExport,
      orgDocuments: orgDocuments.map((d) => ({
        title: d.title,
        mimeType: d.mime_type,
        status: d.status,
        chunkCount: d.chunk_count,
        metadata: d.metadata,
        createdAt: d.created_at,
      })),
      complianceChecks: complianceChecks.map((c) => ({
        surrogateId: c.surrogate_id,
        frameworkId: c.framework_id,
        status: c.status,
        results: c.results,
        passed: c.passed,
        failed: c.failed,
        score: c.score,
        createdAt: c.created_at,
      })),
    };

    // Optional: memory entries
    if (options.includeMemory) {
      const memories = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
        tenant.orgSlug,
        `SELECT * FROM memory_entries ${dateFilter.where} ORDER BY created_at ASC`,
        dateFilter.params,
      );
      exportData.memoryEntries = memories.map((m) => ({
        surrogateId: m.surrogate_id,
        type: m.type,
        source: m.source,
        content: m.content,
        tags: m.tags,
        observationCount: m.observation_count,
        firstObservedAt: m.first_observed_at,
        lastObservedAt: m.last_observed_at,
        createdAt: m.created_at,
      }));
    }

    // Optional: audit log
    if (options.includeAudit) {
      const auditEntries = await this.tenantManager.executeInTenant<AuditEntryRow[]>(
        tenant.orgSlug,
        `SELECT * FROM audit_entries ${dateFilter.where} ORDER BY created_at ASC`,
        dateFilter.params,
      );
      exportData.auditLog = auditEntries.map((a) => ({
        action: a.action,
        surrogateId: a.surrogate_id,
        userId: a.user_id,
        details: a.details,
        rationale: a.rationale,
        confidence: a.confidence,
        humanAuthRequired: a.human_auth_required,
        hash: a.hash,
        previousHash: a.previous_hash,
        createdAt: a.created_at,
      }));
    }

    // Count total records
    let recordCount = surrogates.length + sops.length + templates.length + orgDocuments.length + complianceChecks.length;
    if (exportData.memoryEntries) recordCount += exportData.memoryEntries.length;
    if (exportData.auditLog) recordCount += exportData.auditLog.length;

    const exportJson = JSON.stringify(exportData);
    const fileSizeBytes = Buffer.byteLength(exportJson, 'utf8');

    // Record export history
    await this.recordExportHistory(tenant, {
      type: 'ORG_EXPORT',
      recordCount,
      fileSizeBytes,
      options: { ...options } as Record<string, unknown>,
      userId,
    });

    // Audit
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.ORG_DATA_EXPORTED,
      details: { type: 'ORG_EXPORT', recordCount, ...options },
    });

    return exportData;
  }

  // =========================================================================
  // Export Surrogate
  // =========================================================================

  async exportSurrogate(
    tenant: TenantContext,
    surrogateId: string,
    userId: string,
  ): Promise<SurrogateExportData> {
    // Verify surrogate exists
    const surrogates = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `SELECT * FROM surrogates WHERE id = $1::uuid`,
      [surrogateId],
    );
    if (surrogates.length === 0) {
      throw new NotFoundError('Surrogate not found');
    }
    const s = surrogates[0];

    // SOPs for this surrogate
    const sops = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sops WHERE surrogate_id = $1::uuid ORDER BY version ASC`,
      [surrogateId],
    );

    // Memory entries
    const memories = await this.tenantManager.executeInTenant<MemoryEntryRow[]>(
      tenant.orgSlug,
      `SELECT * FROM memory_entries WHERE surrogate_id = $1::uuid ORDER BY created_at ASC`,
      [surrogateId],
    );

    // Sessions
    const sessions = await this.tenantManager.executeInTenant<SessionRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sessions WHERE surrogate_id = $1::uuid ORDER BY created_at ASC`,
      [surrogateId],
    );

    const exportData: SurrogateExportData = {
      exportVersion: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      type: 'SURROGATE_EXPORT',
      surrogate: {
        roleTitle: s.role_title,
        domain: s.domain,
        jurisdiction: s.jurisdiction,
        status: s.status,
        config: s.config,
        createdAt: s.created_at,
      },
      sops: sops.map((sop) => ({
        version: sop.version,
        status: sop.status,
        title: sop.title,
        description: sop.description,
        graph: sop.graph,
        certifiedBy: sop.certified_by,
        hash: sop.hash,
        createdAt: sop.created_at,
      })),
      memoryEntries: memories.map((m) => ({
        type: m.type,
        source: m.source,
        content: m.content,
        tags: m.tags,
        observationCount: m.observation_count,
        firstObservedAt: m.first_observed_at,
        lastObservedAt: m.last_observed_at,
        createdAt: m.created_at,
      })),
      sessions: sessions.map((sess) => ({
        status: sess.status,
        metadata: sess.metadata,
        startedAt: sess.started_at,
        endedAt: sess.ended_at,
      })),
    };

    const recordCount = 1 + sops.length + memories.length + sessions.length;
    const exportJson = JSON.stringify(exportData);
    const fileSizeBytes = Buffer.byteLength(exportJson, 'utf8');

    await this.recordExportHistory(tenant, {
      type: 'SURROGATE_EXPORT',
      recordCount,
      fileSizeBytes,
      options: { surrogateId },
      userId,
    });

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId,
      userId,
      action: AuditAction.ORG_DATA_EXPORTED,
      details: { type: 'SURROGATE_EXPORT', surrogateId, recordCount },
    });

    return exportData;
  }

  // =========================================================================
  // Export SOPs
  // =========================================================================

  async exportSOPs(
    tenant: TenantContext,
    surrogateId: string | undefined,
    userId: string,
  ): Promise<SOPExportData> {
    let sops: SOPRow[];

    if (surrogateId) {
      sops = await this.tenantManager.executeInTenant<SOPRow[]>(
        tenant.orgSlug,
        `SELECT * FROM sops WHERE surrogate_id = $1::uuid ORDER BY version ASC`,
        [surrogateId],
      );
    } else {
      sops = await this.tenantManager.executeInTenant<SOPRow[]>(
        tenant.orgSlug,
        `SELECT * FROM sops ORDER BY created_at ASC`,
      );
    }

    const exportData: SOPExportData = {
      exportVersion: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      type: 'SOP_EXPORT',
      sops: sops.map((sop) => ({
        surrogateId: sop.surrogate_id,
        version: sop.version,
        status: sop.status,
        title: sop.title,
        description: sop.description,
        graph: sop.graph,
        certifiedBy: sop.certified_by,
        hash: sop.hash,
        createdAt: sop.created_at,
      })),
    };

    const exportJson = JSON.stringify(exportData);
    const fileSizeBytes = Buffer.byteLength(exportJson, 'utf8');

    await this.recordExportHistory(tenant, {
      type: 'SOP_EXPORT',
      recordCount: sops.length,
      fileSizeBytes,
      options: { surrogateId: surrogateId ?? null },
      userId,
    });

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: surrogateId ?? null,
      userId,
      action: AuditAction.ORG_DATA_EXPORTED,
      details: { type: 'SOP_EXPORT', sopCount: sops.length, surrogateId: surrogateId ?? null },
    });

    return exportData;
  }

  // =========================================================================
  // Import Org
  // =========================================================================

  async importOrg(
    tenant: TenantContext,
    data: OrgImportData,
    userId: string,
  ): Promise<{ surrogatesCreated: number; sopsCreated: number; personaTemplatesCreated: number; memoryEntriesCreated: number; orgDocumentsCreated: number }> {
    // Validate structure
    if (!data || data.type !== 'ORG_EXPORT') {
      throw new ValidationError('Invalid import data: expected type ORG_EXPORT');
    }
    if (!data.exportVersion) {
      throw new ValidationError('Invalid import data: missing exportVersion');
    }

    const surrogateIdMap = new Map<number, string>(); // index -> new UUID
    let surrogatesCreated = 0;
    let sopsCreated = 0;
    let personaTemplatesCreated = 0;
    let memoryEntriesCreated = 0;
    let orgDocumentsCreated = 0;

    // Import surrogates
    if (data.surrogates && data.surrogates.length > 0) {
      for (let i = 0; i < data.surrogates.length; i++) {
        const s = data.surrogates[i];
        const rows = await this.tenantManager.executeInTenant<SurrogateRow[]>(
          tenant.orgSlug,
          `INSERT INTO surrogates (role_title, domain, jurisdiction, status, config)
           VALUES ($1, $2, $3, $4, $5::jsonb)
           RETURNING *`,
          [s.roleTitle, s.domain, s.jurisdiction, s.status ?? 'DRAFT', JSON.stringify(s.config ?? {})],
        );
        surrogateIdMap.set(i, rows[0].id);
        surrogatesCreated++;
      }
    }

    // Import SOPs (link to newly created surrogates via index)
    if (data.sops && data.sops.length > 0) {
      for (const sop of data.sops) {
        const targetSurrogateId =
          sop.surrogateId ??
          (sop.surrogateIndex !== undefined ? surrogateIdMap.get(sop.surrogateIndex) : undefined);

        if (!targetSurrogateId) {
          continue; // skip SOPs without a valid surrogate reference
        }

        await this.tenantManager.executeInTenant<SOPRow[]>(
          tenant.orgSlug,
          `INSERT INTO sops (surrogate_id, version, status, title, description, graph, hash)
           VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7)
           RETURNING *`,
          [
            targetSurrogateId,
            sop.version ?? 1,
            sop.status ?? 'DRAFT',
            sop.title,
            sop.description ?? null,
            JSON.stringify(sop.graph),
            sop.hash,
          ],
        );
        sopsCreated++;
      }
    }

    // Import persona templates
    if (data.personaTemplates && data.personaTemplates.length > 0) {
      for (const pt of data.personaTemplates) {
        const rows = await this.tenantManager.executeInTenant<PersonaTemplateRow[]>(
          tenant.orgSlug,
          `INSERT INTO persona_templates (name, description, domain, jurisdiction, base_config, tags, category, status, current_version)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::text[], $7, $8, $9)
           RETURNING *`,
          [
            pt.name,
            pt.description ?? null,
            pt.domain,
            pt.jurisdiction,
            JSON.stringify(pt.baseConfig ?? {}),
            pt.tags ?? [],
            pt.category ?? null,
            'DRAFT',
            pt.currentVersion ?? '1.0.0',
          ],
        );
        const templateId = rows[0].id;

        // Import versions
        if (pt.versions && pt.versions.length > 0) {
          for (const v of pt.versions) {
            await this.tenantManager.executeInTenant(
              tenant.orgSlug,
              `INSERT INTO persona_versions (template_id, version, config, changelog, created_by)
               VALUES ($1::uuid, $2, $3::jsonb, $4, $5::uuid)`,
              [templateId, v.version, JSON.stringify(v.config), v.changelog ?? null, userId],
            );
          }
        }
        personaTemplatesCreated++;
      }
    }

    // Import memory entries
    if (data.memoryEntries && data.memoryEntries.length > 0) {
      for (const m of data.memoryEntries) {
        const targetSurrogateId =
          m.surrogateId ??
          (m.surrogateIndex !== undefined ? surrogateIdMap.get(m.surrogateIndex) : undefined);

        if (!targetSurrogateId) continue;

        const now = new Date();
        await this.tenantManager.executeInTenant(
          tenant.orgSlug,
          `INSERT INTO memory_entries (surrogate_id, type, source, content, tags, observation_count, first_observed_at, last_observed_at)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $7)`,
          [
            targetSurrogateId,
            m.type,
            m.source,
            m.content,
            m.tags ?? [],
            m.observationCount ?? 1,
            now,
          ],
        );
        memoryEntriesCreated++;
      }
    }

    // Import org documents (metadata only, no chunks)
    if (data.orgDocuments && data.orgDocuments.length > 0) {
      for (const doc of data.orgDocuments) {
        await this.tenantManager.executeInTenant(
          tenant.orgSlug,
          `INSERT INTO org_documents (title, mime_type, status, metadata)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [doc.title, doc.mimeType ?? 'text/plain', doc.status ?? 'PROCESSING', JSON.stringify(doc.metadata ?? {})],
        );
        orgDocumentsCreated++;
      }
    }

    const totalCreated = surrogatesCreated + sopsCreated + personaTemplatesCreated + memoryEntriesCreated + orgDocumentsCreated;

    // Record export history as an import entry
    await this.recordExportHistory(tenant, {
      type: 'ORG_IMPORT',
      recordCount: totalCreated,
      fileSizeBytes: null,
      options: { importVersion: data.exportVersion },
      userId,
    });

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.ORG_DATA_IMPORTED,
      details: {
        type: 'ORG_IMPORT',
        surrogatesCreated,
        sopsCreated,
        personaTemplatesCreated,
        memoryEntriesCreated,
        orgDocumentsCreated,
      },
    });

    return { surrogatesCreated, sopsCreated, personaTemplatesCreated, memoryEntriesCreated, orgDocumentsCreated };
  }

  // =========================================================================
  // Import SOPs
  // =========================================================================

  async importSOPs(
    tenant: TenantContext,
    data: SOPImportData,
    surrogateId: string,
    userId: string,
  ): Promise<{ sopsCreated: number }> {
    if (!data || data.type !== 'SOP_EXPORT') {
      throw new ValidationError('Invalid import data: expected type SOP_EXPORT');
    }
    if (!data.sops || !Array.isArray(data.sops)) {
      throw new ValidationError('Invalid import data: missing sops array');
    }

    // Verify surrogate exists
    const surrogates = await this.tenantManager.executeInTenant<SurrogateRow[]>(
      tenant.orgSlug,
      `SELECT * FROM surrogates WHERE id = $1::uuid`,
      [surrogateId],
    );
    if (surrogates.length === 0) {
      throw new NotFoundError('Surrogate not found');
    }

    // Get current max version for this surrogate
    const maxVersionRows = await this.tenantManager.executeInTenant<{ max_version: number }[]>(
      tenant.orgSlug,
      `SELECT COALESCE(MAX(version), 0) as max_version FROM sops WHERE surrogate_id = $1::uuid`,
      [surrogateId],
    );
    let nextVersion = (maxVersionRows[0]?.max_version ?? 0) + 1;

    let sopsCreated = 0;

    for (const sop of data.sops) {
      await this.tenantManager.executeInTenant<SOPRow[]>(
        tenant.orgSlug,
        `INSERT INTO sops (surrogate_id, version, status, title, description, graph, hash)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7)
         RETURNING *`,
        [
          surrogateId,
          nextVersion++,
          'DRAFT', // Always import as DRAFT for safety
          sop.title,
          sop.description ?? null,
          JSON.stringify(sop.graph),
          sop.hash,
        ],
      );
      sopsCreated++;
    }

    await this.recordExportHistory(tenant, {
      type: 'SOP_IMPORT',
      recordCount: sopsCreated,
      fileSizeBytes: null,
      options: { surrogateId },
      userId,
    });

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId,
      userId,
      action: AuditAction.ORG_DATA_IMPORTED,
      details: { type: 'SOP_IMPORT', surrogateId, sopsCreated },
    });

    return { sopsCreated };
  }

  // =========================================================================
  // Export History
  // =========================================================================

  async getExportHistory(
    tenant: TenantContext,
    pagination: PaginationParams,
  ) {
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM export_history`,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<ExportHistoryRow[]>(
      tenant.orgSlug,
      `SELECT * FROM export_history ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapExportHistoryRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private async recordExportHistory(
    tenant: TenantContext,
    entry: {
      type: string;
      recordCount: number;
      fileSizeBytes: number | null;
      options: Record<string, unknown>;
      userId: string;
    },
  ): Promise<void> {
    await this.tenantManager.executeInTenant(
      tenant.orgSlug,
      `INSERT INTO export_history (type, status, record_count, file_size_bytes, options, exported_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::uuid)`,
      [entry.type, 'COMPLETED', entry.recordCount, entry.fileSizeBytes, JSON.stringify(entry.options), entry.userId],
    );
  }

  private buildDateFilter(dateRange?: { start: string; end: string }): {
    where: string;
    params: unknown[];
  } {
    if (!dateRange) {
      return { where: '', params: [] };
    }

    const params: unknown[] = [];
    const clauses: string[] = [];

    if (dateRange.start) {
      params.push(new Date(dateRange.start));
      clauses.push(`created_at >= $${params.length}`);
    }
    if (dateRange.end) {
      params.push(new Date(dateRange.end));
      clauses.push(`created_at <= $${params.length}`);
    }

    if (clauses.length === 0) {
      return { where: '', params: [] };
    }

    return { where: `WHERE ${clauses.join(' AND ')}`, params };
  }
}
