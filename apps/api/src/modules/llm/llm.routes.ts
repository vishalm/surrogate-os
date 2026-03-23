import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { LLMService } from './llm.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError, InternalError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';
import { config } from '../../config/index.js';

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

  // POST /generate-sop — generate an SOP using Claude
  fastify.post(
    '/generate-sop',
    { preHandler: [guard] },
    async (request, reply) => {
      // Check API key is configured
      if (!config.ANTHROPIC_API_KEY) {
        throw new InternalError(
          'LLM service is not configured. Set ANTHROPIC_API_KEY environment variable.',
        );
      }

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

export const llmRoutes = fp(llmRoutesCallback, {
  name: 'llm-routes',
  fastify: '5.x',
});
