import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  triggerBiasCheckSchema,
  paginationSchema,
} from '@surrogate-os/shared';
import { BiasService } from './bias.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface BiasRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const biasRoutesCallback: FastifyPluginCallback<BiasRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const biasService = new BiasService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // POST /check — trigger a bias check
  fastify.post(
    '/check',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = triggerBiasCheckSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const result = await biasService.triggerBiasCheck(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  // GET /checks — list bias checks with pagination
  fastify.get(
    '/checks',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await biasService.listChecks(request.tenant!, pagination);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /checks/:id — get a single bias check
  fastify.get<{ Params: { id: string } }>(
    '/checks/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const check = await biasService.getCheck(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: check, error: null });
    },
  );

  // GET /distribution — get decision distribution
  fastify.get(
    '/distribution',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const distribution = await biasService.getDecisionDistribution(
        request.tenant!,
        query.surrogateId,
      );
      return reply.send({ success: true, data: distribution, error: null });
    },
  );

  // GET /anomalies — get recent anomalies
  fastify.get(
    '/anomalies',
    { preHandler: [guard] },
    async (request, reply) => {
      const anomalies = await biasService.getAnomalies(request.tenant!);
      return reply.send({ success: true, data: anomalies, error: null });
    },
  );

  // GET /dashboard — get aggregated dashboard data
  fastify.get(
    '/dashboard',
    { preHandler: [guard] },
    async (request, reply) => {
      const dashboard = await biasService.getDashboardData(request.tenant!);
      return reply.send({ success: true, data: dashboard, error: null });
    },
  );

  done();
};

export const biasRoutes = biasRoutesCallback;
