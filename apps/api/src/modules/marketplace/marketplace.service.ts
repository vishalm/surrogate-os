import type { PrismaClient } from '@prisma/client';
import type {
  PublishMarketplaceListingInput,
  CreateMarketplaceReviewInput,
  PaginatedResponse,
} from '@surrogate-os/shared';
import { AuditAction, MarketplaceListingStatus } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';

interface SOPRow {
  id: string;
  surrogate_id: string;
  version: number;
  status: string;
  title: string;
  description: string | null;
  graph: Record<string, unknown>;
  certified_by: string | null;
  hash: string;
  previous_version_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface BrowseFilters {
  domain?: string;
  category?: string;
  search?: string;
  minRating?: number;
}

export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  /**
   * Publish an SOP from the tenant schema to the public marketplace.
   */
  async publish(
    orgId: string,
    input: PublishMarketplaceListingInput,
    tenant: TenantContext,
    userId: string,
  ) {
    // Fetch SOP from tenant schema
    const sopRows = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `SELECT * FROM sops WHERE id = $1::uuid`,
      [input.sopId],
    );

    if (sopRows.length === 0) {
      throw new NotFoundError('SOP not found in your organization');
    }

    const sop = sopRows[0];

    // Create listing in public schema via Prisma
    const listing = await this.prisma.marketplaceListing.create({
      data: {
        orgId,
        sopTitle: input.title,
        sopDescription: input.description,
        sopGraph: sop.graph as object,
        domain: input.domain,
        category: input.category ?? null,
        tags: input.tags ?? [],
        price: input.price ?? 0,
        status: MarketplaceListingStatus.PUBLISHED,
      },
    });

    // Audit
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: sop.surrogate_id,
      userId,
      action: AuditAction.MARKETPLACE_LISTING_PUBLISHED,
      details: { listingId: listing.id, sopId: input.sopId, title: input.title },
    });

    return listing;
  }

  /**
   * Browse published marketplace listings with filters and pagination.
   */
  async browse(
    filters: BrowseFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<object>> {
    const where: Record<string, unknown> = {
      status: MarketplaceListingStatus.PUBLISHED,
    };

    if (filters.domain) {
      where.domain = filters.domain;
    }
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.search) {
      where.sopTitle = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }
    if (filters.minRating !== undefined && filters.minRating > 0) {
      where.avgRating = { gte: filters.minRating };
    }

    const [listings, total] = await Promise.all([
      this.prisma.marketplaceListing.findMany({
        where,
        orderBy: { installCount: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.marketplaceListing.count({ where }),
    ]);

    return buildPaginatedResponse(listings, total, pagination.page, pagination.pageSize);
  }

  /**
   * Get a single marketplace listing by ID.
   */
  async getById(id: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundError('Marketplace listing not found');
    }

    return listing;
  }

  /**
   * Install a marketplace SOP into the tenant schema.
   */
  async install(
    listingId: string,
    tenant: TenantContext,
    userId: string,
  ) {
    // Fetch listing from public schema
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundError('Marketplace listing not found');
    }

    if (listing.status !== MarketplaceListingStatus.PUBLISHED) {
      throw new ValidationError('This listing is not currently available for installation');
    }

    // We need a surrogate to associate the SOP with. Pick the first surrogate
    // in the tenant, or create a placeholder reference. For marketplace installs
    // we INSERT the SOP with a NULL surrogate_id and DRAFT status.
    // NOTE: The tenant sops table has surrogate_id as a FK. We'll insert
    // with a dummy approach: find any surrogate. If none, error out.
    const surrogates = await this.tenantManager.executeInTenant<{ id: string }[]>(
      tenant.orgSlug,
      `SELECT id FROM surrogates LIMIT 1`,
    );

    if (surrogates.length === 0) {
      throw new ValidationError(
        'You need at least one surrogate in your organization to install marketplace SOPs',
      );
    }

    const surrogateId = surrogates[0].id;

    // Determine next version number for this surrogate
    const maxVersionRows = await this.tenantManager.executeInTenant<{ max_version: number }[]>(
      tenant.orgSlug,
      `SELECT COALESCE(MAX(version), 0) as max_version FROM sops WHERE surrogate_id = $1::uuid`,
      [surrogateId],
    );
    const newVersion = (maxVersionRows[0]?.max_version ?? 0) + 1;

    // Compute a simple hash for the installed SOP
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256')
      .update(JSON.stringify({ graph: listing.sopGraph, title: listing.sopTitle, version: newVersion }))
      .digest('hex');

    // INSERT SOP into tenant schema
    const rows = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `INSERT INTO sops (surrogate_id, version, title, description, graph, hash, status)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, 'DRAFT')
       RETURNING *`,
      [
        surrogateId,
        newVersion,
        listing.sopTitle,
        listing.sopDescription,
        JSON.stringify(listing.sopGraph),
        hash,
      ],
    );

    // Increment install count
    await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { installCount: { increment: 1 } },
    });

    // Audit
    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId,
      userId,
      action: AuditAction.MARKETPLACE_SOP_INSTALLED,
      details: { listingId, sopId: rows[0].id, title: listing.sopTitle },
    });

    return {
      listing,
      installedSop: {
        id: rows[0].id,
        surrogateId: rows[0].surrogate_id,
        version: rows[0].version,
        status: rows[0].status,
        title: rows[0].title,
      },
    };
  }

  /**
   * Add a review to a marketplace listing.
   */
  async addReview(
    listingId: string,
    orgId: string,
    userId: string,
    input: CreateMarketplaceReviewInput,
  ) {
    // Verify listing exists
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundError('Marketplace listing not found');
    }

    // Prevent self-review
    if (listing.orgId === orgId) {
      throw new ValidationError('You cannot review your own listing');
    }

    // Create review (unique constraint on [listingId, orgId] enforced by DB)
    const review = await this.prisma.marketplaceReview.create({
      data: {
        listingId,
        orgId,
        userId,
        rating: input.rating,
        comment: input.comment ?? null,
      },
    });

    // Recalculate avgRating and reviewCount
    const aggregation = await this.prisma.marketplaceReview.aggregate({
      where: { listingId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        avgRating: aggregation._avg.rating,
        reviewCount: aggregation._count.rating,
      },
    });

    return review;
  }

  /**
   * List reviews for a marketplace listing.
   */
  async listReviews(
    listingId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<object>> {
    const where = { listingId };

    const [reviews, total] = await Promise.all([
      this.prisma.marketplaceReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.marketplaceReview.count({ where }),
    ]);

    return buildPaginatedResponse(reviews, total, pagination.page, pagination.pageSize);
  }

  /**
   * Update a marketplace listing (owner org only).
   */
  async updateListing(
    id: string,
    orgId: string,
    input: Partial<Pick<PublishMarketplaceListingInput, 'title' | 'description' | 'domain' | 'category' | 'tags' | 'price'>>,
  ) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundError('Marketplace listing not found');
    }

    if (listing.orgId !== orgId) {
      throw new ForbiddenError('Only the publishing organization can update this listing');
    }

    const updated = await this.prisma.marketplaceListing.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { sopTitle: input.title }),
        ...(input.description !== undefined && { sopDescription: input.description }),
        ...(input.domain !== undefined && { domain: input.domain }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.price !== undefined && { price: input.price }),
      },
    });

    return updated;
  }

  /**
   * Remove a marketplace listing (set status to REMOVED, owner org only).
   */
  async removeListing(id: string, orgId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundError('Marketplace listing not found');
    }

    if (listing.orgId !== orgId) {
      throw new ForbiddenError('Only the publishing organization can remove this listing');
    }

    const updated = await this.prisma.marketplaceListing.update({
      where: { id },
      data: { status: MarketplaceListingStatus.REMOVED },
    });

    return updated;
  }
}
