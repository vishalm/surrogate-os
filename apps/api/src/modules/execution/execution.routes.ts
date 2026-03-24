import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  paginationSchema,
  startExecutionSchema,
  advanceExecutionSchema,
  abortExecutionSchema,
  escalateExecutionSchema,
} from '@surrogate-os/shared';
import { ExecutionService } from './execution.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface ExecutionRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const executionRoutesCallback: FastifyPluginCallback<ExecutionRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const executionService = new ExecutionService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // POST /start — Start a new execution
  fastify.post(
    '/start',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = startExecutionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const execution = await executionService.startExecution(
        request.tenant!,
        parsed.data.surrogateId,
        parsed.data.sopId,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: execution, error: null });
    },
  );

  // POST /:id/advance — Advance execution to next node
  fastify.post<{ Params: { id: string } }>(
    '/:id/advance',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = advanceExecutionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const execution = await executionService.advanceExecution(
        request.tenant!,
        request.params.id,
        parsed.data,
        request.user!.id,
      );
      return reply.send({ success: true, data: execution, error: null });
    },
  );

  // PATCH /:id/pause — Pause execution
  fastify.patch<{ Params: { id: string } }>(
    '/:id/pause',
    { preHandler: [guard] },
    async (request, reply) => {
      const execution = await executionService.pauseExecution(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.send({ success: true, data: execution, error: null });
    },
  );

  // PATCH /:id/resume — Resume execution
  fastify.patch<{ Params: { id: string } }>(
    '/:id/resume',
    { preHandler: [guard] },
    async (request, reply) => {
      const execution = await executionService.resumeExecution(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.send({ success: true, data: execution, error: null });
    },
  );

  // POST /:id/abort — Abort execution
  fastify.post<{ Params: { id: string } }>(
    '/:id/abort',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = abortExecutionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const execution = await executionService.abortExecution(
        request.tenant!,
        request.params.id,
        parsed.data.reason,
        request.user!.id,
      );
      return reply.send({ success: true, data: execution, error: null });
    },
  );

  // POST /:id/escalate — Trigger escalation
  fastify.post<{ Params: { id: string } }>(
    '/:id/escalate',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = escalateExecutionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const execution = await executionService.escalate(
        request.tenant!,
        request.params.id,
        parsed.data.reason,
        request.user!.id,
      );
      return reply.send({ success: true, data: execution, error: null });
    },
  );

  // GET /:id — Get execution state
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const execution = await executionService.getExecution(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: execution, error: null });
    },
  );

  // GET / — List executions
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const query = request.query as Record<string, string>;
      const filters: { status?: string; surrogateId?: string } = {};
      if (query.status) filters.status = query.status;
      if (query.surrogateId) filters.surrogateId = query.surrogateId;

      const result = await executionService.listExecutions(
        request.tenant!,
        pagination,
        filters,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /:id/timeline — Decision timeline
  fastify.get<{ Params: { id: string } }>(
    '/:id/timeline',
    { preHandler: [guard] },
    async (request, reply) => {
      const timeline = await executionService.getExecutionTimeline(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: timeline, error: null });
    },
  );

  // GET /:id/transitions — Available transitions from current node
  fastify.get<{ Params: { id: string } }>(
    '/:id/transitions',
    { preHandler: [guard] },
    async (request, reply) => {
      const transitions = await executionService.getTransitions(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: transitions, error: null });
    },
  );

  done();
};

export const executionRoutes = executionRoutesCallback;
