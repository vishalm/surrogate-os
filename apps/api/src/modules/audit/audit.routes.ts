import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import type { PrismaClient } from '@prisma/client';
import { createAuditEntrySchema, paginationSchema } from '@surrogate-os/shared';
import { z } from 'zod';
import { AuditService } from './audit.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

const auditFilterSchema = z.object({
  surrogateId: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

interface AuditRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const auditRoutesCallback: FastifyPluginCallback<AuditRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const auditService = new AuditService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // POST / — create an audit entry
  fastify.post(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createAuditEntrySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const entry = await auditService.create(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: entry, error: null });
    },
  );

  // GET / — list audit entries with filters
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>;

      const filtersParsed = auditFilterSchema.safeParse(query);
      const filters = filtersParsed.success ? filtersParsed.data : {};

      const paginationParsed = paginationSchema.safeParse(query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await auditService.list(request.tenant!, filters, pagination);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /:id/verify — verify audit chain integrity
  fastify.get<{ Params: { id: string }; Querystring: { endId?: string } }>(
    '/:id/verify',
    { preHandler: [guard] },
    async (request, reply) => {
      const result = await auditService.verifyChain(
        request.tenant!,
        request.params.id,
        (request.query as { endId?: string }).endId,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const auditRoutes = auditRoutesCallback;
