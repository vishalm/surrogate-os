import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { uploadDocumentSchema, paginationSchema, UserRole } from '@surrogate-os/shared';
import { z } from 'zod';
import { OrgDNAService } from './org-dna.service.js';
import { OrgService } from '../orgs/orgs.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';
import type { EmbeddingSettings } from './embedding.js';

interface OrgDNARoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const searchBodySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional(),
});

const orgDNARoutesCallback: FastifyPluginCallback<OrgDNARoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const orgDNAService = new OrgDNAService(opts.prisma, opts.tenantManager);
  const orgService = new OrgService(opts.prisma);
  const guard = authGuard(opts.prisma);
  const ownerAdminOnly = requireRole([UserRole.OWNER, UserRole.ADMIN]);

  async function getEmbeddingSettings(orgId: string): Promise<EmbeddingSettings> {
    const settings = await orgService.getRawSettings(orgId);
    const provider = settings.embeddingProvider as string | undefined;
    const model = settings.embeddingModel as string | undefined;
    const apiKey = settings.embeddingApiKey as string | undefined;
    const endpoint = settings.embeddingEndpoint as string | undefined;

    if (!provider || !model) {
      throw new ValidationError('Embedding provider and model must be configured in organization settings');
    }

    if (provider !== 'ollama' && !apiKey) {
      throw new ValidationError('Embedding API key must be configured in organization settings');
    }

    return { provider, model, apiKey: apiKey ?? '', endpoint };
  }

  // POST /documents — upload a document
  fastify.post(
    '/documents',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = uploadDocumentSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const embeddingSettings = await getEmbeddingSettings(request.tenant!.orgId);

      const { document, content } = await orgDNAService.uploadDocument(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );

      // Process document asynchronously (don't await)
      orgDNAService
        .processDocument(request.tenant!, document.id, content, embeddingSettings)
        .catch((err) => {
          request.log.error({ err, documentId: document.id }, 'Document processing failed');
        });

      return reply.status(201).send({ success: true, data: document, error: null });
    },
  );

  // GET /documents — list documents with pagination
  fastify.get(
    '/documents',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await orgDNAService.listDocuments(request.tenant!, pagination);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /documents/:id — get a single document
  fastify.get<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const document = await orgDNAService.getDocument(request.tenant!, request.params.id);
      return reply.send({ success: true, data: document, error: null });
    },
  );

  // DELETE /documents/:id — delete a document (OWNER/ADMIN only)
  fastify.delete<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [guard, ownerAdminOnly] },
    async (request, reply) => {
      await orgDNAService.deleteDocument(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.send({ success: true, data: null, error: null });
    },
  );

  // POST /search — search document chunks by semantic similarity
  fastify.post(
    '/search',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = searchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const embeddingSettings = await getEmbeddingSettings(request.tenant!.orgId);

      const context = await orgDNAService.getRelevantContext(
        request.tenant!,
        parsed.data.query,
        embeddingSettings,
        parsed.data.limit,
      );

      return reply.send({ success: true, data: { context }, error: null });
    },
  );

  done();
};

export const orgDNARoutes = orgDNARoutesCallback;
