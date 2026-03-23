import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginCallback,
} from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { UserRole } from '@surrogate-os/shared';
import { verifyAccessToken } from '../lib/crypto.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import type { TenantContext } from '../tenancy/tenant-context.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
}

interface AuthPluginOptions {
  prisma: PrismaClient;
}

const authPluginCallback: FastifyPluginCallback<AuthPluginOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const { prisma } = opts;

  fastify.decorateRequest('user', null);
  // tenant is decorated by tenant-context, but we ensure it here too
  if (!fastify.hasRequestDecorator('tenant')) {
    fastify.decorateRequest('tenant', null);
  }

  done();
};

export const authPlugin = fp(authPluginCallback, {
  name: 'auth',
  fastify: '5.x',
});

/**
 * PreHandler hook that extracts and verifies JWT from Authorization header,
 * then populates request.user and request.tenant.
 */
export function authGuard(prisma: PrismaClient) {
  return async function authGuardHandler(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const decoded = verifyAccessToken(token);

    // Look up user and org from the public schema
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { org: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.org) {
      throw new UnauthorizedError('Organization not found');
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
    };

    request.tenant = {
      orgId: user.org.id,
      orgSlug: user.org.slug,
      schemaName: user.org.schemaName,
    } satisfies TenantContext;
  };
}

/**
 * Factory that creates a preHandler hook requiring specific roles.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async function roleGuardHandler(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError(
        `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
      );
    }
  };
}
