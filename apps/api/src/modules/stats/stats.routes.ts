import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { StatsService } from './stats.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { authGuard } from '../../middleware/auth.js';

interface StatsRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const statsRoutesCallback: FastifyPluginCallback<StatsRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const statsService = new StatsService(opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // GET /dashboard — get dashboard stats
  fastify.get(
    '/dashboard',
    { preHandler: [guard] },
    async (request, reply) => {
      const stats = await statsService.getDashboardStats(request.tenant!);
      return reply.send({ success: true, data: stats, error: null });
    },
  );

  done();
};

export const statsRoutes = statsRoutesCallback;
