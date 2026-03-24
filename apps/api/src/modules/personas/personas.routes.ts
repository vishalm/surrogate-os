import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import type { PrismaClient } from '@prisma/client';
import {
  createPersonaTemplateSchema,
  updatePersonaTemplateSchema,
  paginationSchema,
  UserRole,
} from '@surrogate-os/shared';
import { PersonaService } from './personas.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';
import type { PersonaListFilters } from './personas.service.js';

interface PersonaRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const personaRoutesCallback: FastifyPluginCallback<PersonaRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const personaService = new PersonaService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);
  const ownerAdminGuard = requireRole([UserRole.OWNER, UserRole.ADMIN]);

  // POST / — create persona template
  fastify.post(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createPersonaTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const template = await personaService.create(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: template, error: null });
    },
  );

  // GET / — list persona templates
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const filters: PersonaListFilters = {};
      if (query.domain) filters.domain = query.domain;
      if (query.category) filters.category = query.category;
      if (query.tags) filters.tags = query.tags.split(',').map((t) => t.trim());
      if (query.status) filters.status = query.status;

      const result = await personaService.list(request.tenant!, pagination, filters);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /:id — get single persona template with versions
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const template = await personaService.getById(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: template, error: null });
    },
  );

  // PATCH /:id — update persona template
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = updatePersonaTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const template = await personaService.update(
        request.tenant!,
        request.params.id,
        parsed.data,
        request.user!.id,
      );
      return reply.send({ success: true, data: template, error: null });
    },
  );

  // POST /:id/rollback — rollback to a specific version
  fastify.post<{ Params: { id: string } }>(
    '/:id/rollback',
    { preHandler: [guard] },
    async (request, reply) => {
      const body = request.body as { version?: string };
      if (!body.version) {
        throw new ValidationError('version is required');
      }

      const template = await personaService.rollback(
        request.tenant!,
        request.params.id,
        body.version,
        request.user!.id,
      );
      return reply.send({ success: true, data: template, error: null });
    },
  );

  // POST /:id/instantiate — create surrogate from template
  fastify.post<{ Params: { id: string } }>(
    '/:id/instantiate',
    { preHandler: [guard] },
    async (request, reply) => {
      const surrogate = await personaService.instantiate(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: surrogate, error: null });
    },
  );

  // GET /:id/export — export template as JSON
  fastify.get<{ Params: { id: string } }>(
    '/:id/export',
    { preHandler: [guard] },
    async (request, reply) => {
      const exported = await personaService.exportTemplate(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: exported, error: null });
    },
  );

  // POST /import — import template from JSON
  fastify.post(
    '/import',
    { preHandler: [guard] },
    async (request, reply) => {
      const data = request.body as {
        template: {
          name: string;
          description?: string | null;
          domain: string;
          jurisdiction: string;
          baseConfig?: Record<string, unknown>;
          tags?: string[];
          category?: string | null;
          status?: string;
          currentVersion?: string;
        };
        versions: Array<{
          version: string;
          config: Record<string, unknown>;
          changelog?: string | null;
        }>;
      };

      if (!data.template || !data.versions) {
        throw new ValidationError('template and versions are required');
      }

      const template = await personaService.importTemplate(
        request.tenant!,
        data,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: template, error: null });
    },
  );

  // DELETE /:id — soft delete (OWNER/ADMIN only)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard, ownerAdminGuard] },
    async (request, reply) => {
      await personaService.delete(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.status(204).send();
    },
  );

  done();
};

export const personaRoutes = personaRoutesCallback;
