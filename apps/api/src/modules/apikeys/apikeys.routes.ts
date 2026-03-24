import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import type { PrismaClient } from '@prisma/client';
import { UserRole } from '@surrogate-os/shared';
import { z } from 'zod';
import { ApiKeyService } from './apikeys.service.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().nullable().optional(),
  isTest: z.boolean().optional(),
});

interface ApiKeyRoutesOptions {
  prisma: PrismaClient;
}

const apiKeyRoutesCallback: FastifyPluginCallback<ApiKeyRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const apiKeyService = new ApiKeyService(opts.prisma);
  const guard = authGuard(opts.prisma);
  const adminOnly = requireRole([UserRole.OWNER, UserRole.ADMIN]);

  // POST / — Create API key
  fastify.post(
    '/',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      const parsed = createApiKeySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const result = await apiKeyService.createApiKey(
        request.tenant!.orgId,
        parsed.data.name,
        parsed.data.scopes,
        parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        request.user!.id,
        parsed.data.isTest,
      );

      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  // GET / — List API keys
  fastify.get(
    '/',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      const keys = await apiKeyService.listApiKeys(request.tenant!.orgId);
      return reply.send({ success: true, data: keys, error: null });
    },
  );

  // DELETE /:id — Revoke API key
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      const result = await apiKeyService.revokeApiKey(
        request.tenant!.orgId,
        request.params.id,
        request.user!.id,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // POST /:id/rotate — Rotate API key
  fastify.post<{ Params: { id: string } }>(
    '/:id/rotate',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      const result = await apiKeyService.rotateApiKey(
        request.tenant!.orgId,
        request.params.id,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const apiKeyRoutes = apiKeyRoutesCallback;
