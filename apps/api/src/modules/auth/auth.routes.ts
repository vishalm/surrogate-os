import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import type { PrismaClient } from '@prisma/client';
import { createUserSchema, createOrgSchema, loginSchema, UserRole } from '@surrogate-os/shared';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';

const registerBodySchema = z.object({
  email: createUserSchema.shape.email,
  name: createUserSchema.shape.name,
  password: createUserSchema.shape.password,
  orgName: createOrgSchema.shape.name,
  orgSlug: createOrgSchema.shape.slug,
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

const inviteBodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.nativeEnum(UserRole).optional(),
});

interface AuthRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const authRoutesCallback: FastifyPluginCallback<AuthRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const authService = new AuthService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // POST /register
  fastify.post('/register', async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', {
        issues: parsed.error.issues,
      });
    }

    const result = await authService.register(parsed.data);
    return reply.status(201).send({ success: true, data: result, error: null });
  });

  // POST /login
  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', {
        issues: parsed.error.issues,
      });
    }

    const result = await authService.login(parsed.data);
    return reply.send({ success: true, data: result, error: null });
  });

  // POST /refresh
  fastify.post('/refresh', async (request, reply) => {
    const parsed = refreshBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', {
        issues: parsed.error.issues,
      });
    }

    const tokens = await authService.refreshTokens(parsed.data.refreshToken);
    return reply.send({ success: true, data: { tokens }, error: null });
  });

  // POST /invite (protected, requires OWNER or ADMIN)
  fastify.post(
    '/invite',
    {
      preHandler: [guard, requireRole([UserRole.OWNER, UserRole.ADMIN])],
    },
    async (request, reply) => {
      const parsed = inviteBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const user = await authService.inviteMember(
        request.tenant!.orgId,
        parsed.data,
      );
      return reply.status(201).send({ success: true, data: user, error: null });
    },
  );

  done();
};

export const authRoutes = authRoutesCallback;
