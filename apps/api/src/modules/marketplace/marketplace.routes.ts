import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  publishMarketplaceListingSchema,
  createMarketplaceReviewSchema,
  paginationSchema,
} from '@surrogate-os/shared';
import { z } from 'zod';
import { MarketplaceService } from './marketplace.service.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { ValidationError } from '../../lib/errors.js';
import { authGuard } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';

interface MarketplaceRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

const browseQuerySchema = z.object({
  domain: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
});

const updateListingSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  domain: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  price: z.number().min(0).optional(),
});

const marketplaceRoutesCallback: FastifyPluginCallback<MarketplaceRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const marketplaceService = new MarketplaceService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);

  // POST /publish — publish an SOP to the marketplace
  fastify.post(
    '/publish',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = publishMarketplaceListingSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const listing = await marketplaceService.publish(
        request.tenant!.orgId,
        parsed.data,
        request.tenant!,
        request.user!.id,
      );

      return reply.status(201).send({ success: true, data: listing, error: null });
    },
  );

  // GET / — browse marketplace listings
  fastify.get(
    '/',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const filtersParsed = browseQuerySchema.safeParse(request.query);
      const filters = filtersParsed.success ? filtersParsed.data : {};

      const result = await marketplaceService.browse(filters, pagination);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /:id — get a single listing
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const listing = await marketplaceService.getById(request.params.id);
      return reply.send({ success: true, data: listing, error: null });
    },
  );

  // POST /:id/install — install a marketplace SOP
  fastify.post<{ Params: { id: string } }>(
    '/:id/install',
    { preHandler: [guard] },
    async (request, reply) => {
      const result = await marketplaceService.install(
        request.params.id,
        request.tenant!,
        request.user!.id,
      );

      return reply.status(201).send({ success: true, data: result, error: null });
    },
  );

  // POST /:id/reviews — add a review
  fastify.post<{ Params: { id: string } }>(
    '/:id/reviews',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createMarketplaceReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const review = await marketplaceService.addReview(
        request.params.id,
        request.tenant!.orgId,
        request.user!.id,
        parsed.data,
      );

      return reply.status(201).send({ success: true, data: review, error: null });
    },
  );

  // GET /:id/reviews — list reviews for a listing
  fastify.get<{ Params: { id: string } }>(
    '/:id/reviews',
    { preHandler: [guard] },
    async (request, reply) => {
      const paginationParsed = paginationSchema.safeParse(request.query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const result = await marketplaceService.listReviews(
        request.params.id,
        pagination,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // PATCH /:id — update a listing (owner org only)
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = updateListingSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const updated = await marketplaceService.updateListing(
        request.params.id,
        request.tenant!.orgId,
        parsed.data,
      );

      return reply.send({ success: true, data: updated, error: null });
    },
  );

  // DELETE /:id — remove a listing (owner org only)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const removed = await marketplaceService.removeListing(
        request.params.id,
        request.tenant!.orgId,
      );

      return reply.send({ success: true, data: removed, error: null });
    },
  );

  done();
};

export const marketplaceRoutes = marketplaceRoutesCallback;
