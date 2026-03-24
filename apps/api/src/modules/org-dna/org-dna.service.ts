import type { PrismaClient } from '@prisma/client';
import type { PaginatedResponse } from '@surrogate-os/shared';
import { AuditAction, DocumentStatus } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, InternalError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { chunkText, generateEmbedding, type EmbeddingSettings } from './embedding.js';

interface DocumentRow {
  id: string;
  title: string;
  mime_type: string;
  status: string;
  chunk_count: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface ChunkRow {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

interface CountRow {
  count: bigint;
}

function mapDocumentRow(row: DocumentRow) {
  return {
    id: row.id,
    title: row.title,
    mimeType: row.mime_type,
    status: row.status,
    chunkCount: row.chunk_count,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChunkRow(row: ChunkRow) {
  return {
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    chunkIndex: row.chunk_index,
    metadata: row.metadata,
  };
}

export class OrgDNAService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async uploadDocument(
    tenant: TenantContext,
    input: { title: string; content: string; mimeType: string },
    userId: string,
  ) {
    const rows = await this.tenantManager.executeInTenant<DocumentRow[]>(
      tenant.orgSlug,
      `INSERT INTO org_documents (title, mime_type, status, metadata)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [
        input.title,
        input.mimeType,
        DocumentStatus.PROCESSING,
        JSON.stringify({ contentLength: input.content.length }),
      ],
    );

    const document = rows[0];

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.DOCUMENT_UPLOADED,
      details: { documentId: document.id, title: input.title },
    });

    return { document: mapDocumentRow(document), content: input.content };
  }

  async processDocument(
    tenant: TenantContext,
    documentId: string,
    content: string,
    embeddingSettings: EmbeddingSettings,
  ): Promise<void> {
    try {
      const chunks = chunkText(content);

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(embeddingSettings, chunks[i]);

        await this.tenantManager.executeInTenant(
          tenant.orgSlug,
          `INSERT INTO document_chunks (document_id, content, chunk_index, embedding, metadata)
           VALUES ($1::uuid, $2, $3, $4::vector, $5::jsonb)`,
          [
            documentId,
            chunks[i],
            i,
            `[${embedding.join(',')}]`,
            JSON.stringify({}),
          ],
        );
      }

      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `UPDATE org_documents
         SET status = $1, chunk_count = $2, updated_at = $3
         WHERE id = $4::uuid`,
        [DocumentStatus.READY, chunks.length, new Date(), documentId],
      );
    } catch (error) {
      // Mark document as failed on any error
      await this.tenantManager.executeInTenant(
        tenant.orgSlug,
        `UPDATE org_documents
         SET status = $1, updated_at = $2, metadata = metadata || $3::jsonb
         WHERE id = $4::uuid`,
        [
          DocumentStatus.FAILED,
          new Date(),
          JSON.stringify({ error: (error as Error).message }),
          documentId,
        ],
      );
      throw error;
    }
  }

  async listDocuments(
    tenant: TenantContext,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<ReturnType<typeof mapDocumentRow>>> {
    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM org_documents`,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<DocumentRow[]>(
      tenant.orgSlug,
      `SELECT * FROM org_documents
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapDocumentRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getDocument(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<DocumentRow[]>(
      tenant.orgSlug,
      `SELECT * FROM org_documents WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Document not found');
    }

    return mapDocumentRow(rows[0]);
  }

  async deleteDocument(
    tenant: TenantContext,
    id: string,
    userId: string,
  ): Promise<void> {
    // Verify document exists
    const rows = await this.tenantManager.executeInTenant<DocumentRow[]>(
      tenant.orgSlug,
      `SELECT * FROM org_documents WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Document not found');
    }

    // Chunks cascade via ON DELETE CASCADE
    await this.tenantManager.executeInTenant(
      tenant.orgSlug,
      `DELETE FROM org_documents WHERE id = $1::uuid`,
      [id],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.DOCUMENT_PROCESSED,
      details: { documentId: id, action: 'deleted', title: rows[0].title },
    });
  }

  async searchChunks(
    tenant: TenantContext,
    queryEmbedding: number[],
    limit = 5,
  ) {
    const rows = await this.tenantManager.executeInTenant<(ChunkRow & { distance: number })[]>(
      tenant.orgSlug,
      `SELECT *, embedding <=> $1::vector AS distance
       FROM document_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [`[${queryEmbedding.join(',')}]`, limit],
    );

    return rows.map((row) => ({
      ...mapChunkRow(row),
      distance: row.distance,
    }));
  }

  async getRelevantContext(
    tenant: TenantContext,
    query: string,
    embeddingSettings: EmbeddingSettings,
    limit = 5,
  ): Promise<string> {
    const queryEmbedding = await generateEmbedding(embeddingSettings, query);
    const chunks = await this.searchChunks(tenant, queryEmbedding, limit);
    return chunks.map((c) => c.content).join('\n\n');
  }
}
