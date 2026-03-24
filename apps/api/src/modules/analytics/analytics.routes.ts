import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { AnalyticsService } from './analytics.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';

interface AnalyticsRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const analyticsRoutesCallback: FastifyPluginCallback<AnalyticsRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const analyticsService = new AnalyticsService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // GET /dashboard — Dashboard metrics
  fastify.get(
    '/dashboard',
    { preHandler: [guard] },
    async (request, reply) => {
      const metrics = await analyticsService.getDashboardMetrics(request.tenant!);
      return reply.send({ success: true, data: metrics, error: null });
    },
  );

  // GET /time-series — Time series data
  fastify.get(
    '/time-series',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;

      if (!query.metric) {
        throw new ValidationError('metric query parameter is required');
      }
      if (!query.period) {
        throw new ValidationError('period query parameter is required');
      }
      if (!query.start) {
        throw new ValidationError('start query parameter is required');
      }
      if (!query.end) {
        throw new ValidationError('end query parameter is required');
      }

      const data = await analyticsService.getTimeSeriesData(
        request.tenant!,
        query.metric,
        query.period,
        query.start,
        query.end,
      );
      return reply.send({ success: true, data, error: null });
    },
  );

  // GET /surrogates/:id/performance — Surrogate performance
  fastify.get<{ Params: { id: string } }>(
    '/surrogates/:id/performance',
    { preHandler: [guard] },
    async (request, reply) => {
      const data = await analyticsService.getSurrogatePerformance(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data, error: null });
    },
  );

  // GET /domains — Domain breakdown
  fastify.get(
    '/domains',
    { preHandler: [guard] },
    async (request, reply) => {
      const data = await analyticsService.getDomainBreakdown(request.tenant!);
      return reply.send({ success: true, data, error: null });
    },
  );

  // GET /compliance-overview — Compliance overview
  fastify.get(
    '/compliance-overview',
    { preHandler: [guard] },
    async (request, reply) => {
      const data = await analyticsService.getComplianceOverview(request.tenant!);
      return reply.send({ success: true, data, error: null });
    },
  );

  // GET /decision-heatmap — Decision heatmap
  fastify.get(
    '/decision-heatmap',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const data = await analyticsService.getDecisionHeatmap(
        request.tenant!,
        query.surrogateId,
      );
      return reply.send({ success: true, data, error: null });
    },
  );

  // GET /insights — Top insights
  fastify.get(
    '/insights',
    { preHandler: [guard] },
    async (request, reply) => {
      const data = await analyticsService.getTopInsights(request.tenant!);
      return reply.send({ success: true, data, error: null });
    },
  );

  // POST /export — Export report
  fastify.post(
    '/export',
    { preHandler: [guard] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown> | undefined;

      if (!body?.format) {
        throw new ValidationError('format is required in request body (csv or json)');
      }

      const filters = (body.filters as Record<string, string>) ?? {};

      const result = await analyticsService.exportReport(
        request.tenant!,
        body.format as string,
        {
          metric: filters.metric as string | undefined,
          startDate: filters.startDate as string | undefined,
          endDate: filters.endDate as string | undefined,
          surrogateId: filters.surrogateId as string | undefined,
        },
      );

      // For CSV, return as downloadable content
      if (result.format === 'csv') {
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.data);
      }

      return reply.send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const analyticsRoutes = analyticsRoutesCallback;
