import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  createMemoryEntrySchema,
  paginationSchema,
  UserRole,
} from '@surrogate-os/shared';
import { z } from 'zod';
import { MemoryService } from './memory.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface MemoryRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const detectPatternsSchema = z.object({
  surrogateId: z.string().uuid(),
});

const memoryRoutesCallback: FastifyPluginCallback<MemoryRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const memoryService = new MemoryService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);
  const ownerOrAdmin = requireRole([UserRole.OWNER, UserRole.ADMIN]);

  // GET / — list memory entries with optional filters + pagination
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const query = request.query as Record<string, string>;
      const filters: { surrogateId?: string; type?: string; tags?: string[] } = {};
      if (query.surrogateId) filters.surrogateId = query.surrogateId;
      if (query.type) filters.type = query.type;
      if (query.tags) filters.tags = query.tags.split(',').map((t) => t.trim());

      const result = await memoryService.listEntries(request.tenant!, filters, pagination);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /:id — get single memory entry
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const entry = await memoryService.getEntry(request.tenant!, request.params.id);
      return reply.send({ success: true, data: entry, error: null });
    },
  );

  // POST / — create memory entry
  fastify.post(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createMemoryEntrySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const entry = await memoryService.createEntry(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: entry, error: null });
    },
  );

  // PATCH /:id/promote — promote STM to LTM (OWNER/ADMIN)
  fastify.patch<{ Params: { id: string } }>(
    '/:id/promote',
    { preHandler: [guard, ownerOrAdmin] },
    async (request, reply) => {
      const entry = await memoryService.promoteToLTM(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.send({ success: true, data: entry, error: null });
    },
  );

  // DELETE /:id — archive (delete) memory entry (OWNER/ADMIN)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard, ownerOrAdmin] },
    async (request, reply) => {
      await memoryService.archiveEntry(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.status(204).send();
    },
  );

  // POST /detect-patterns — run pattern detection
  fastify.post(
    '/detect-patterns',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = detectPatternsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const result = await memoryService.detectPatterns(
        request.tenant!,
        parsed.data.surrogateId,
        request.user!.id,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // POST /cleanup — cleanup expired STM entries (OWNER/ADMIN)
  fastify.post(
    '/cleanup',
    { preHandler: [guard, ownerOrAdmin] },
    async (request, reply) => {
      const result = await memoryService.cleanupExpiredSTM(request.tenant!);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const memoryRoutes = memoryRoutesCallback;
