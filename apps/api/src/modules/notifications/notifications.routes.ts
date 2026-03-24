import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import type { PrismaClient } from '@prisma/client';
import { paginationSchema } from '@surrogate-os/shared';
import { z } from 'zod';
import { NotificationService } from './notifications.service.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface NotificationRoutesOptions {
  prisma: PrismaClient;
}

const notificationRoutesCallback: FastifyPluginCallback<NotificationRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const notificationService = new NotificationService(opts.prisma);
  const guard = authGuard(opts.prisma);

  // GET / — List notifications for current user
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const query = request.query as { unreadOnly?: string };
      const unreadOnly = query.unreadOnly === 'true';

      const result = await notificationService.listNotifications(
        request.user!.id,
        pagination,
        unreadOnly,
      );

      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /unread-count — Get unread count
  fastify.get(
    '/unread-count',
    { preHandler: [guard] },
    async (request, reply) => {
      const count = await notificationService.getUnreadCount(request.user!.id);
      return reply.send({ success: true, data: { count }, error: null });
    },
  );

  // PATCH /:id/read — Mark notification as read
  fastify.patch<{ Params: { id: string } }>(
    '/:id/read',
    { preHandler: [guard] },
    async (request, reply) => {
      const result = await notificationService.markAsRead(
        request.user!.id,
        request.params.id,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // PATCH /read-all — Mark all as read
  fastify.patch(
    '/read-all',
    { preHandler: [guard] },
    async (request, reply) => {
      const result = await notificationService.markAllAsRead(request.user!.id);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const notificationRoutes = notificationRoutesCallback;
