import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import type { PrismaClient } from '@prisma/client';
import {
  createSurrogateSchema,
  updateSurrogateSchema,
  paginationSchema,
} from '@surrogate-os/shared';
import { SurrogateService } from './surrogates.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface SurrogateRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const surrogateRoutesCallback: FastifyPluginCallback<SurrogateRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const surrogateService = new SurrogateService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // POST / — create surrogate
  fastify.post(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createSurrogateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const surrogate = await surrogateService.create(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: surrogate, error: null });
    },
  );

  // GET / — list surrogates
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await surrogateService.list(request.tenant!, pagination);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /:id — get single surrogate
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const surrogate = await surrogateService.getById(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: surrogate, error: null });
    },
  );

  // PATCH /:id — update surrogate
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = updateSurrogateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const surrogate = await surrogateService.update(
        request.tenant!,
        request.params.id,
        parsed.data,
        request.user!.id,
      );
      return reply.send({ success: true, data: surrogate, error: null });
    },
  );

  // DELETE /:id — soft delete surrogate
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      await surrogateService.delete(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.status(204).send();
    },
  );

  done();
};

export const surrogateRoutes = fp(surrogateRoutesCallback, {
  name: 'surrogate-routes',
  fastify: '5.x',
});
