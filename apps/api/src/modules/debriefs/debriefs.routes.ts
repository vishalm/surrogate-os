import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  createSessionSchema,
  createDecisionOutcomeSchema,
  paginationSchema,
} from '@surrogate-os/shared';
import { DebriefService } from './debriefs.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import type { ServiceRegistry } from '../../lib/service-registry.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface DebriefRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
  registry?: ServiceRegistry;
}

const debriefRoutesCallback: FastifyPluginCallback<DebriefRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const debriefService = opts.registry?.has('DebriefService')
    ? opts.registry.resolve<DebriefService>('DebriefService')
    : new DebriefService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // POST /sessions — start a new session
  fastify.post(
    '/sessions',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const session = await debriefService.startSession(
        request.tenant!,
        parsed.data.surrogateId,
        parsed.data.metadata,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: session, error: null });
    },
  );

  // POST /sessions/:sessionId/decisions — record a decision
  fastify.post<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/decisions',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createDecisionOutcomeSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const decision = await debriefService.recordDecision(
        request.tenant!,
        request.params.sessionId,
        {
          surrogateId: parsed.data.surrogateId,
          sopNodeId: parsed.data.sopNodeId,
          decision: parsed.data.decision,
          outcome: parsed.data.outcome,
          confidence: parsed.data.confidence,
          context: parsed.data.context,
        },
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: decision, error: null });
    },
  );

  // PATCH /sessions/:sessionId/complete — complete a session
  fastify.patch<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/complete',
    { preHandler: [guard] },
    async (request, reply) => {
      const session = await debriefService.completeSession(
        request.tenant!,
        request.params.sessionId,
        request.user!.id,
      );
      return reply.send({ success: true, data: session, error: null });
    },
  );

  // POST /sessions/:sessionId/generate — generate debrief from session
  fastify.post<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/generate',
    { preHandler: [guard] },
    async (request, reply) => {
      const debrief = await debriefService.generateDebrief(
        request.tenant!,
        request.params.sessionId,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: debrief, error: null });
    },
  );

  // GET /sessions — list sessions with pagination and filters
  fastify.get(
    '/sessions',
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

      const result = await debriefService.listSessions(request.tenant!, pagination, filters);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /sessions/:sessionId — get session detail
  fastify.get<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId',
    { preHandler: [guard] },
    async (request, reply) => {
      const session = await debriefService.getSession(
        request.tenant!,
        request.params.sessionId,
      );
      return reply.send({ success: true, data: session, error: null });
    },
  );

  // GET /sessions/:sessionId/debrief — get debrief for a session
  fastify.get<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/debrief',
    { preHandler: [guard] },
    async (request, reply) => {
      const debrief = await debriefService.getDebrief(
        request.tenant!,
        request.params.sessionId,
      );
      return reply.send({ success: true, data: debrief, error: null });
    },
  );

  // GET / — list all debriefs
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await debriefService.listDebriefs(request.tenant!, pagination);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /analytics — debrief analytics
  fastify.get(
    '/analytics',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const analytics = await debriefService.getAnalytics(
        request.tenant!,
        query.surrogateId,
      );
      return reply.send({ success: true, data: analytics, error: null });
    },
  );

  done();
};

export const debriefRoutes = debriefRoutesCallback;
