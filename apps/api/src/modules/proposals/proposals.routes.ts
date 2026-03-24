import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  createSOPProposalSchema,
  reviewSOPProposalSchema,
  paginationSchema,
  UserRole,
} from '@surrogate-os/shared';
import { ProposalService } from './proposals.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface ProposalRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const proposalRoutesCallback: FastifyPluginCallback<ProposalRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const proposalService = new ProposalService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);
  const ownerAdminOnly = requireRole([UserRole.OWNER, UserRole.ADMIN]);

  // POST /from-debrief — create proposal from debrief analysis
  fastify.post(
    '/from-debrief',
    { preHandler: [guard] },
    async (request, reply) => {
      const body = request.body as { sopId?: string; debriefId?: string };
      if (!body.sopId || !body.debriefId) {
        throw new ValidationError('sopId and debriefId are required');
      }

      const proposal = await proposalService.createFromDebrief(
        request.tenant!,
        body.sopId,
        body.debriefId,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: proposal, error: null });
    },
  );

  // POST / — create manual proposal
  fastify.post(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createSOPProposalSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      if (!parsed.data.proposedGraph) {
        throw new ValidationError('proposedGraph is required for manual proposals');
      }
      if (!parsed.data.rationale) {
        throw new ValidationError('rationale is required for manual proposals');
      }

      const proposal = await proposalService.createManual(
        request.tenant!,
        parsed.data.sopId,
        parsed.data.proposedGraph,
        parsed.data.rationale,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: proposal, error: null });
    },
  );

  // GET / — list proposals with pagination and filters
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const query = request.query as Record<string, string>;
      const filters: { sopId?: string; status?: string } = {};
      if (query.sopId) filters.sopId = query.sopId;
      if (query.status) filters.status = query.status;

      const result = await proposalService.listProposals(request.tenant!, pagination, filters);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /:id — get proposal detail
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const proposal = await proposalService.getProposal(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: proposal, error: null });
    },
  );

  // PATCH /:id/review — approve or reject (OWNER/ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/:id/review',
    { preHandler: [guard, ownerAdminOnly] },
    async (request, reply) => {
      const parsed = reviewSOPProposalSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const proposal = await proposalService.reviewProposal(
        request.tenant!,
        request.params.id,
        parsed.data.status,
        request.user!.id,
      );
      return reply.send({ success: true, data: proposal, error: null });
    },
  );

  done();
};

export const proposalRoutes = proposalRoutesCallback;
