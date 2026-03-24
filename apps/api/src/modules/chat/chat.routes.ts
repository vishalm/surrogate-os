import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@surrogate-os/shared';
import { ChatService } from './chat.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface ChatRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const createConversationSchema = z.object({
  surrogateId: z.string().uuid(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(32000),
});

const chatRoutesCallback: FastifyPluginCallback<ChatRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const chatService = new ChatService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // POST /conversations — create conversation
  fastify.post(
    '/conversations',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createConversationSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const conversation = await chatService.createConversation(
        request.tenant!,
        parsed.data.surrogateId,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: conversation, error: null });
    },
  );

  // POST /conversations/:id/messages — send message
  fastify.post<{ Params: { id: string } }>(
    '/conversations/:id/messages',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = sendMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const result = await chatService.sendMessage(
        request.tenant!,
        request.params.id,
        parsed.data.content,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  // GET /conversations — list conversations
  fastify.get(
    '/conversations',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await chatService.listConversations(
        request.tenant!,
        request.user!.id,
        pagination,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /conversations/:id — get conversation with messages
  fastify.get<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const result = await chatService.getConversation(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // DELETE /conversations/:id — soft delete conversation
  fastify.delete<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      await chatService.deleteConversation(
        request.tenant!,
        request.params.id,
        request.user!.id,
      );
      return reply.status(204).send();
    },
  );

  done();
};

export const chatRoutes = chatRoutesCallback;
