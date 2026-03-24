import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import type { PrismaClient } from '@prisma/client';
import {
  paginationSchema,
  fleetFilterSchema,
} from '@surrogate-os/shared';
import { FleetService } from './fleet.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface FleetRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const fleetRoutesCallback: FastifyPluginCallback<FleetRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const fleetService = new FleetService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // GET /status — fleet status overview
  fastify.get(
    '/status',
    { preHandler: [guard] },
    async (request, reply) => {
      const status = await fleetService.getFleetStatus(request.tenant!);
      return reply.send({ success: true, data: status, error: null });
    },
  );

  // GET /surrogates — enriched surrogates list
  fastify.get(
    '/surrogates',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>;

      const filterParsed = fleetFilterSchema.safeParse(query);
      const filters = filterParsed.success ? filterParsed.data : {};

      const paginationParsed = paginationSchema.safeParse(query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await fleetService.getEnrichedSurrogates(
        request.tenant!,
        filters,
        pagination,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /surrogates/:id/health — surrogate health metrics
  fastify.get<{ Params: { id: string } }>(
    '/surrogates/:id/health',
    { preHandler: [guard] },
    async (request, reply) => {
      const health = await fleetService.getSurrogateHealth(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: health, error: null });
    },
  );

  // GET /analytics — fleet-wide analytics
  fastify.get(
    '/analytics',
    { preHandler: [guard] },
    async (request, reply) => {
      const analytics = await fleetService.getFleetAnalytics(request.tenant!);
      return reply.send({ success: true, data: analytics, error: null });
    },
  );

  // GET /sessions/active — active sessions with surrogate info
  fastify.get(
    '/sessions/active',
    { preHandler: [guard] },
    async (request, reply) => {
      const sessions = await fleetService.getActiveSessions(request.tenant!);
      return reply.send({ success: true, data: sessions, error: null });
    },
  );

  done();
};

export const fleetRoutes = fleetRoutesCallback;
