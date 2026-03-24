import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  createFederationContributionSchema,
  federationInsightsQuerySchema,
  applyFederationInsightsSchema,
  updateFederationParticipationSchema,
  paginationSchema,
  UserRole,
} from '@surrogate-os/shared';
import { FederationService } from './federation.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface FederationRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const federationRoutesCallback: FastifyPluginCallback<FederationRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const federationService = new FederationService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);
  const ownerOnly = requireRole([UserRole.OWNER]);

  // POST /contribute — Submit anonymized decision data
  fastify.post(
    '/contribute',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createFederationContributionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const contribution = await federationService.createContribution(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );

      return reply.status(201).send({ success: true, data: contribution, error: null });
    },
  );

  // GET /contributions — List org's contributions
  fastify.get(
    '/contributions',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await federationService.listContributions(
        request.tenant!.orgId,
        pagination,
      );

      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /insights — Get pool insights (with domain/category filters)
  fastify.get(
    '/insights',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = federationInsightsQuerySchema.safeParse(request.query);
      const filters = parsed.success ? parsed.data : {};

      const insights = await federationService.getPoolInsights(
        filters.domain,
        filters.category,
      );

      return reply.send({ success: true, data: insights, error: null });
    },
  );

  // POST /apply/:sopId — Apply insights to SOP
  fastify.post<{ Params: { sopId: string } }>(
    '/apply/:sopId',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = applyFederationInsightsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const result = await federationService.applyInsightsToSOP(
        request.tenant!,
        request.params.sopId,
        parsed.data.insights,
        request.user!.id,
        parsed.data.rationale,
      );

      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  // GET /privacy-report — Privacy budget report
  fastify.get(
    '/privacy-report',
    { preHandler: [guard] },
    async (request, reply) => {
      const report = await federationService.getPrivacyReport(
        request.tenant!.orgId,
      );

      return reply.send({ success: true, data: report, error: null });
    },
  );

  // PATCH /participation — Opt in/out (OWNER only)
  fastify.patch(
    '/participation',
    { preHandler: [guard, ownerOnly] },
    async (request, reply) => {
      const parsed = updateFederationParticipationSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      let result;
      if (parsed.data.optedIn) {
        result = await federationService.optIn(
          request.tenant!.orgId,
          request.user!.id,
          request.tenant!.orgSlug,
          parsed.data.domains,
        );
      } else {
        result = await federationService.optOut(
          request.tenant!.orgId,
          request.user!.id,
          request.tenant!.orgSlug,
        );
      }

      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /leaderboard — Contribution leaderboard
  fastify.get(
    '/leaderboard',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const leaderboard = await federationService.getLeaderboard(
        query.domain || undefined,
      );

      return reply.send({ success: true, data: leaderboard, error: null });
    },
  );

  done();
};

export const federationRoutes = federationRoutesCallback;
