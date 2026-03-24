import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { LLMService, LLM_PROVIDERS } from './llm.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';

interface LLMRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const generateSOPBodySchema = z.object({
  surrogateId: z.string().min(1),
  additionalContext: z.string().max(2000).optional(),
});

const llmRoutesCallback: FastifyPluginCallback<LLMRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const llmService = new LLMService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // GET /providers — list available LLM providers and their config fields
  fastify.get(
    '/providers',
    { preHandler: [guard] },
    async (_request, reply) => {
      return reply.send({ success: true, data: LLM_PROVIDERS, error: null });
    },
  );

  // POST /generate-sop — generate an SOP using the configured LLM provider
  fastify.post(
    '/generate-sop',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = generateSOPBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const result = await llmService.generateSOP(
        request.tenant!,
        parsed.data.surrogateId,
        request.user!.id,
        { additionalContext: parsed.data.additionalContext },
      );

      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  done();
};

export const llmRoutes = llmRoutesCallback;
