import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import type { PrismaClient } from '@prisma/client';
import { updateOrgSchema, UserRole } from '@surrogate-os/shared';
import { OrgService } from './orgs.service.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';

interface OrgRoutesOptions {
  prisma: PrismaClient;
}

const orgRoutesCallback: FastifyPluginCallback<OrgRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const orgService = new OrgService(opts.prisma);
  const guard = authGuard(opts.prisma);

  // GET /me — get current user's org
  fastify.get(
    '/me',
    { preHandler: [guard] },
    async (request, reply) => {
      const org = await orgService.getOrg(request.tenant!.orgId);
      return reply.send({ success: true, data: org, error: null });
    },
  );

  // PATCH /me — update current user's org
  fastify.patch(
    '/me',
    {
      preHandler: [guard, requireRole([UserRole.OWNER, UserRole.ADMIN])],
    },
    async (request, reply) => {
      const parsed = updateOrgSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const org = await orgService.updateOrg(request.tenant!.orgId, parsed.data);
      return reply.send({ success: true, data: org, error: null });
    },
  );

  // GET /me/members — list members of current org
  fastify.get(
    '/me/members',
    { preHandler: [guard] },
    async (request, reply) => {
      const members = await orgService.getMembers(request.tenant!.orgId);
      return reply.send({ success: true, data: members, error: null });
    },
  );

  // DELETE /me/members/:id — remove a member
  fastify.delete<{ Params: { id: string } }>(
    '/me/members/:id',
    {
      preHandler: [guard, requireRole([UserRole.OWNER, UserRole.ADMIN])],
    },
    async (request, reply) => {
      await orgService.removeMember(
        request.tenant!.orgId,
        request.params.id,
        request.user!.id,
      );
      return reply.status(204).send();
    },
  );

  done();
};

export const orgRoutes = fp(orgRoutesCallback, {
  name: 'org-routes',
  fastify: '5.x',
});
