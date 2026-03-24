import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { paginationSchema, UserRole } from '@surrogate-os/shared';
import { ComplianceService } from './compliance.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface ComplianceRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const complianceRoutesCallback: FastifyPluginCallback<ComplianceRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const complianceService = new ComplianceService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);
  const ownerAdminOnly = requireRole([UserRole.OWNER, UserRole.ADMIN]);

  // POST /check/:surrogateId — Run compliance check
  fastify.post<{ Params: { surrogateId: string } }>(
    '/check/:surrogateId',
    { preHandler: [guard] },
    async (request, reply) => {
      const { surrogateId } = request.params;
      const body = request.body as Record<string, string> | undefined;
      const frameworkId = body?.frameworkId;

      if (!frameworkId) {
        throw new ValidationError('frameworkId is required in request body');
      }

      const result = await complianceService.runComplianceCheck(
        request.tenant!,
        surrogateId,
        frameworkId,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  // GET /frameworks — List frameworks
  fastify.get(
    '/frameworks',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const frameworks = complianceService.listFrameworks({
        domain: query.domain,
        jurisdiction: query.jurisdiction,
      });
      return reply.send({ success: true, data: frameworks, error: null });
    },
  );

  // GET /frameworks/:id — Framework detail
  fastify.get<{ Params: { id: string } }>(
    '/frameworks/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const framework = complianceService.getFramework(request.params.id);
      return reply.send({ success: true, data: framework, error: null });
    },
  );

  // POST /sign/:sopId — Sign SOP (OWNER/ADMIN only)
  fastify.post<{ Params: { sopId: string } }>(
    '/sign/:sopId',
    { preHandler: [guard, ownerAdminOnly] },
    async (request, reply) => {
      const result = await complianceService.signSOP(
        request.tenant!,
        request.params.sopId,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  // GET /verify/:sopId — Verify SOP
  fastify.get<{ Params: { sopId: string } }>(
    '/verify/:sopId',
    { preHandler: [guard] },
    async (request, reply) => {
      const result = await complianceService.verifySOP(
        request.tenant!,
        request.params.sopId,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /history/:surrogateId — Compliance check history
  fastify.get<{ Params: { surrogateId: string } }>(
    '/history/:surrogateId',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await complianceService.getComplianceHistory(
        request.tenant!,
        request.params.surrogateId,
        pagination,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /status/:surrogateId — Current certification status
  fastify.get<{ Params: { surrogateId: string } }>(
    '/status/:surrogateId',
    { preHandler: [guard] },
    async (request, reply) => {
      const result = await complianceService.getCertificationStatus(
        request.tenant!,
        request.params.surrogateId,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // POST /report/:surrogateId — Generate report
  fastify.post<{ Params: { surrogateId: string } }>(
    '/report/:surrogateId',
    { preHandler: [guard] },
    async (request, reply) => {
      const body = request.body as Record<string, string> | undefined;
      const frameworkId = body?.frameworkId;

      if (!frameworkId) {
        throw new ValidationError('frameworkId is required in request body');
      }

      const result = await complianceService.generateComplianceReport(
        request.tenant!,
        request.params.surrogateId,
        frameworkId,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const complianceRoutes = complianceRoutesCallback;
