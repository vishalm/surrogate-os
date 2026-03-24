import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { paginationSchema } from '@surrogate-os/shared';
import { z } from 'zod';
import { ActivityService } from './activity.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

const activityFilterSchema = z.object({
  userId: z.string().optional(),
  surrogateId: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const statsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('week'),
});

const searchQuerySchema = z.object({
  q: z.string().min(1),
  types: z.string().optional(), // comma-separated: surrogate,sop,memory
});

interface ActivityRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const activityRoutesCallback: FastifyPluginCallback<ActivityRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const activityService = new ActivityService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // GET /feed — Activity feed with pagination and filters
  fastify.get(
    '/feed',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>;

      const paginationParsed = paginationSchema.safeParse(query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const filtersParsed = activityFilterSchema.safeParse(query);
      const filters = filtersParsed.success ? filtersParsed.data : {};

      const result = await activityService.getActivityFeed(
        request.tenant!,
        pagination,
        filters,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /stats — Activity stats for a time period
  fastify.get(
    '/stats',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = statsQuerySchema.safeParse(request.query);
      const period = parsed.success ? parsed.data.period : 'week';

      const result = await activityService.getActivityStats(
        request.tenant!,
        period,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /search — Global search across entities
  fastify.get(
    '/search',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = searchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.send({ success: true, data: [], error: null });
      }

      const { q, types } = parsed.data;
      const entityTypes = types
        ? types.split(',').map((t) => t.trim())
        : undefined;

      const result = await activityService.searchGlobal(
        request.tenant!,
        q,
        entityTypes,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const activityRoutes = activityRoutesCallback;
