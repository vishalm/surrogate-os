import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  createHandoffSchema,
  paginationSchema,
} from '@surrogate-os/shared';
import { HandoffService } from './handoffs.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface HandoffRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const handoffRoutesCallback: FastifyPluginCallback<HandoffRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const handoffService = new HandoffService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // POST / — initiate a handoff
  fastify.post(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createHandoffSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const handoff = await handoffService.initiateHandoff(
        request.tenant!,
        {
          surrogateId: parsed.data.surrogateId,
          targetSurrogateId: parsed.data.targetSurrogateId,
          targetHumanId: parsed.data.targetHumanId,
          type: parsed.data.type,
          sessionId: parsed.data.sessionId,
          context: parsed.data.context,
        },
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: handoff, error: null });
    },
  );

  // POST /:id/accept — accept a handoff
  fastify.post<{ Params: { id: string } }>(
    '/:id/accept',
    { preHandler: [guard] },
    async (request, reply) => {
      const handoff = await handoffService.acceptHandoff(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.send({ success: true, data: handoff, error: null });
    },
  );

  // POST /:id/reject — reject a handoff
  fastify.post<{ Params: { id: string } }>(
    '/:id/reject',
    { preHandler: [guard] },
    async (request, reply) => {
      const handoff = await handoffService.rejectHandoff(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.send({ success: true, data: handoff, error: null });
    },
  );

  // GET / — list handoffs with pagination and filters
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const query = request.query as Record<string, string>;
      const filters: { status?: string; type?: string; surrogateId?: string } = {};
      if (query.status) filters.status = query.status;
      if (query.type) filters.type = query.type;
      if (query.surrogateId) filters.surrogateId = query.surrogateId;

      const result = await handoffService.listHandoffs(request.tenant!, pagination, filters);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /:id — get a single handoff
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const handoff = await handoffService.getHandoff(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: handoff, error: null });
    },
  );

  done();
};

export const handoffRoutes = handoffRoutesCallback;
