'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Star, Download, Calendar, Building2 } from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  Pagination,
} from '@/components/ui';
import { useToast } from '@/components/ui';
import { apiClient } from '@/lib/api';
import type {
  MarketplaceListing,
  MarketplaceReview,
  PaginatedResponse,
} from '@surrogate-os/shared';
import SOPGraphView from '@/components/sop-graph';

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null || rating === undefined) {
    return <span className="text-sm text-[var(--color-text-muted)]">No ratings yet</span>;
  }
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`h-4 w-4 ${i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-text-muted)]'}`}
      />,
    );
  }
  return (
    <span className="flex items-center gap-1">
      {stars}
      <span className="ml-1 text-sm font-medium">{rating.toFixed(1)}</span>
    </span>
  );
}

function ReviewStars({ rating }: { rating: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`h-3.5 w-3.5 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-text-muted)]'}`}
      />,
    );
  }
  return <span className="flex items-center gap-0.5">{stars}</span>;
}

export default function MarketplaceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchListing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<MarketplaceListing>(`/marketplace/${id}`);
      if (res.success && res.data) {
        setListing(res.data);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReviews = useCallback(async (currentPage: number) => {
    try {
      const res = await apiClient.get<PaginatedResponse<MarketplaceReview>>(
        `/marketplace/${id}/reviews?page=${currentPage}&pageSize=10`,
      );
      if (res.success && res.data) {
        setReviews(res.data.data);
        setReviewTotalPages(res.data.totalPages ?? 1);
      }
    } catch {
      // Ignore
    }
  }, [id]);

  useEffect(() => {
    fetchListing();
    fetchReviews(1);
  }, [fetchListing, fetchReviews]);

  useEffect(() => {
    fetchReviews(reviewPage);
  }, [reviewPage, fetchReviews]);

  async function handleInstall() {
    setInstalling(true);
    try {
      const res = await apiClient.post(`/marketplace/${id}/install`, {});
      if (res.success) {
        toast('success', 'The SOP has been installed to your organization as a draft.');
        // Refresh listing to get updated install count
        fetchListing();
      } else {
        toast('error', res.error?.message ?? 'Failed to install SOP');
      }
    } catch {
      toast('error', 'Failed to install SOP');
    } finally {
      setInstalling(false);
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const res = await apiClient.post(`/marketplace/${id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment || undefined,
      });
      if (res.success) {
        toast('success', 'Your review has been added.');
        setReviewComment('');
        setReviewRating(5);
        fetchReviews(1);
        setReviewPage(1);
        fetchListing(); // refresh rating
      } else {
        toast('error', res.error?.message ?? 'Failed to submit review');
      }
    } catch {
      toast('error', 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">
        Listing not found
      </div>
    );
  }

  const sopGraph = listing.sopGraph as { nodes?: unknown[]; edges?: unknown[] } | null;
  const hasGraph = sopGraph && Array.isArray(sopGraph.nodes) && sopGraph.nodes.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{listing.sopTitle}</h1>
            <Badge variant="default" className="capitalize">{listing.domain}</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
            <StarRating rating={listing.avgRating} />
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {listing.installCount} installs
            </span>
            <span className="font-medium text-[var(--color-text-primary)]">
              {listing.price === 0 ? 'Free' : `$${listing.price.toFixed(2)}`}
            </span>
          </div>
        </div>
        <Button onClick={handleInstall} disabled={installing}>
          {installing ? 'Installing...' : 'Install SOP'}
        </Button>
      </div>

      {/* Description */}
      <Card>
        <div className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Description</h2>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
            {listing.sopDescription}
          </p>
          {listing.tags && listing.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {listing.tags.map((tag) => (
                <Badge key={tag} variant="muted" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Metadata */}
      <Card>
        <div className="flex flex-wrap gap-6 p-4 text-sm">
          {listing.category && (
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <Building2 className="h-4 w-4" />
              <span>Category: <span className="font-medium text-[var(--color-text-primary)]">{listing.category}</span></span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <Calendar className="h-4 w-4" />
            <span>Published: <span className="font-medium text-[var(--color-text-primary)]">{new Date(listing.createdAt).toLocaleDateString()}</span></span>
          </div>
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <span>{listing.reviewCount} review{listing.reviewCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </Card>

      {/* SOP Graph Preview */}
      {hasGraph && (
        <Card>
          <div className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">SOP Graph Preview</h2>
            <SOPGraphView graph={sopGraph as { nodes: any[]; edges: any[] }} />
          </div>
        </Card>
      )}

      {/* Reviews Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Reviews</h2>

        {/* Add Review Form */}
        <Card>
          <form onSubmit={handleSubmitReview} className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Add a Review</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--color-text-secondary)]">Rating:</label>
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
              >
                {[5, 4, 3, 2, 1].map((val) => (
                  <option key={val} value={val}>{val} star{val !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Write a comment (optional)..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
            />
            <Button type="submit" size="sm" disabled={submittingReview}>
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </Button>
          </form>
        </Card>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No reviews yet. Be the first to review!</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <ReviewStars rating={review.rating} />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-[var(--color-text-secondary)]">{review.comment}</p>
                  )}
                </div>
              </Card>
            ))}
            <Pagination
              page={reviewPage}
              totalPages={reviewTotalPages}
              onPageChange={setReviewPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
