import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createSOPSchema, paginationSchema, SOPStatus } from '@surrogate-os/shared';
import { z } from 'zod';
import { SOPService } from './sops.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface SOPRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const statusTransitionSchema = z.object({
  status: z.nativeEnum(SOPStatus),
});

const sopRoutesCallback: FastifyPluginCallback<SOPRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const sopService = new SOPService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // GET / — list all SOPs (tenant-scoped, with optional filters)
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const query = request.query as Record<string, string>;
      const filters: { surrogateId?: string; status?: string } = {};
      if (query.surrogateId) filters.surrogateId = query.surrogateId;
      if (query.status) filters.status = query.status;

      const result = await sopService.listAll(request.tenant!, pagination, filters);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /:id — get a single SOP
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const sop = await sopService.getById(request.tenant!, request.params.id);
      return reply.send({ success: true, data: sop, error: null });
    },
  );

  // POST / — create a new SOP for a surrogate
  fastify.post(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createSOPSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const sop = await sopService.create(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: sop, error: null });
    },
  );

  // POST /:sopId/versions — create a new SOP version
  fastify.post<{ Params: { sopId: string } }>(
    '/:sopId/versions',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createSOPSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const sop = await sopService.createVersion(
        request.tenant!,
        request.params.sopId,
        parsed.data,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: sop, error: null });
    },
  );

  // PATCH /:id/status — transition SOP status
  fastify.patch<{ Params: { id: string } }>(
    '/:id/status',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = statusTransitionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid status', {
          issues: parsed.error.issues,
        });
      }

      const sop = await sopService.transitionStatus(
        request.tenant!,
        request.params.id,
        parsed.data.status,
        request.user!.id,
      );
      return reply.send({ success: true, data: sop, error: null });
    },
  );

  done();
};

export const sopRoutes = sopRoutesCallback;
