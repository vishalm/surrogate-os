import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { UserRole, paginationSchema } from '@surrogate-os/shared';
import { z } from 'zod';
import { ExportService, type ExportOrgOptions } from './export.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface ExportRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const exportOrgSchema = z.object({
  includeAudit: z.boolean().optional().default(false),
  includeMemory: z.boolean().optional().default(false),
  dateRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
});

const importOrgSchema = z.object({
  exportVersion: z.string(),
  type: z.literal('ORG_EXPORT'),
  surrogates: z.array(z.object({
    roleTitle: z.string(),
    domain: z.string(),
    jurisdiction: z.string(),
    status: z.string().optional(),
    config: z.record(z.unknown()).optional(),
  })).optional(),
  sops: z.array(z.object({
    surrogateIndex: z.number().optional(),
    surrogateId: z.string().optional(),
    version: z.number().optional(),
    status: z.string().optional(),
    title: z.string(),
    description: z.string().nullable().optional(),
    graph: z.record(z.unknown()),
    hash: z.string(),
  })).optional(),
  personaTemplates: z.array(z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    domain: z.string(),
    jurisdiction: z.string(),
    baseConfig: z.record(z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().nullable().optional(),
    currentVersion: z.string().optional(),
    versions: z.array(z.object({
      version: z.string(),
      config: z.record(z.unknown()),
      changelog: z.string().nullable().optional(),
    })).optional(),
  })).optional(),
  memoryEntries: z.array(z.object({
    surrogateIndex: z.number().optional(),
    surrogateId: z.string().optional(),
    type: z.string(),
    source: z.string(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
    observationCount: z.number().optional(),
  })).optional(),
  orgDocuments: z.array(z.object({
    title: z.string(),
    mimeType: z.string().optional(),
    status: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
});

const importSOPsSchema = z.object({
  exportVersion: z.string(),
  type: z.literal('SOP_EXPORT'),
  sops: z.array(z.object({
    title: z.string(),
    description: z.string().nullable().optional(),
    graph: z.record(z.unknown()),
    hash: z.string(),
    version: z.number().optional(),
    status: z.string().optional(),
  })),
});

const exportRoutesCallback: FastifyPluginCallback<ExportRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const exportService = new ExportService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);
  const ownerAdminOnly = requireRole([UserRole.OWNER, UserRole.ADMIN]);

  // POST /org - Export full org data
  fastify.post(
    '/org',
    { preHandler: [guard, ownerAdminOnly] },
    async (request, reply) => {
      const parsed = exportOrgSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        throw new ValidationError('Validation failed', { issues: parsed.error.issues });
      }

      const options: ExportOrgOptions = parsed.data;
      const data = await exportService.exportOrg(request.tenant!, options, request.user!.id);
      return reply.send({ success: true, data, error: null });
    },
  );

  // POST /surrogate/:id - Export single surrogate
  fastify.post<{ Params: { id: string } }>(
    '/surrogate/:id',
    { preHandler: [guard, ownerAdminOnly] },
    async (request, reply) => {
      const data = await exportService.exportSurrogate(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.send({ success: true, data, error: null });
    },
  );

  // POST /sops - Export SOPs
  fastify.post(
    '/sops',
    { preHandler: [guard, ownerAdminOnly] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const surrogateId = query.surrogateId || undefined;
      const data = await exportService.exportSOPs(
        request.tenant!,
        surrogateId,
        request.user!.id,
      );
      return reply.send({ success: true, data, error: null });
    },
  );

  // POST /import/org - Import org data
  fastify.post(
    '/import/org',
    { preHandler: [guard, ownerAdminOnly] },
    async (request, reply) => {
      const parsed = importOrgSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid import data', { issues: parsed.error.issues });
      }

      const result = await exportService.importOrg(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // POST /import/sops - Import SOPs
  fastify.post(
    '/import/sops',
    { preHandler: [guard, ownerAdminOnly] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const surrogateId = query.surrogateId;
      if (!surrogateId) {
        throw new ValidationError('surrogateId query parameter is required');
      }

      const parsed = importSOPsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid SOP import data', { issues: parsed.error.issues });
      }

      const result = await exportService.importSOPs(
        request.tenant!,
        parsed.data,
        surrogateId,
        request.user!.id,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /history - Export history
  fastify.get(
    '/history',
    { preHandler: [guard, ownerAdminOnly] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await exportService.getExportHistory(request.tenant!, pagination);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const exportRoutes = exportRoutesCallback;
