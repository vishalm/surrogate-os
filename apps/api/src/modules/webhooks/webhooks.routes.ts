import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import type { PrismaClient } from '@prisma/client';
import { UserRole, paginationSchema } from '@surrogate-os/shared';
import { z } from 'zod';
import { WebhookService } from './webhooks.service.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard, requireRole } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

const registerWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
});

interface WebhookRoutesOptions {
  prisma: PrismaClient;
}

const webhookRoutesCallback: FastifyPluginCallback<WebhookRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const webhookService = new WebhookService(opts.prisma);
  const guard = authGuard(opts.prisma);
  const adminOnly = requireRole([UserRole.OWNER, UserRole.ADMIN]);

  // POST / — Register webhook
  fastify.post(
    '/',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      const parsed = registerWebhookSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const result = await webhookService.registerWebhook(
        request.tenant!.orgId,
        parsed.data.url,
        parsed.data.events,
        parsed.data.secret,
        request.user!.id,
      );

      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  // GET / — List webhooks
  fastify.get(
    '/',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      const webhooks = await webhookService.listWebhooks(request.tenant!.orgId);
      return reply.send({ success: true, data: webhooks, error: null });
    },
  );

  // PATCH /:id — Update webhook
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      const parsed = updateWebhookSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const result = await webhookService.updateWebhook(
        request.tenant!.orgId,
        request.params.id,
        parsed.data,
      );

      return reply.send({ success: true, data: result, error: null });
    },
  );

  // DELETE /:id — Delete webhook
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      await webhookService.deleteWebhook(
        request.tenant!.orgId,
        request.params.id,
      );
      return reply.status(204).send();
    },
  );

  // GET /:id/deliveries — Delivery log
  fastify.get<{ Params: { id: string } }>(
    '/:id/deliveries',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await webhookService.getDeliveryLog(
        request.tenant!.orgId,
        request.params.id,
        pagination,
      );

      return reply.send({ success: true, data: result, error: null });
    },
  );

  // POST /:id/test — Send test webhook
  fastify.post<{ Params: { id: string } }>(
    '/:id/test',
    { preHandler: [guard, adminOnly] },
    async (request, reply) => {
      const result = await webhookService.sendTestWebhook(
        request.tenant!.orgId,
        request.params.id,
      );

      return reply.send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const webhookRoutes = webhookRoutesCallback;
