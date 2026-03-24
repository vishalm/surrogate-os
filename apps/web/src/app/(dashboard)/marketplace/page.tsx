'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Store, Star, Download } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Pagination,
  Badge,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { MarketplaceListing, PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 12;

const DOMAIN_OPTIONS = [
  { value: '', label: 'All Domains' },
  { value: 'legal', label: 'Legal' },
  { value: 'medical', label: 'Medical' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'customer-support', label: 'Customer Support' },
];

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null || rating === undefined) {
    return <span className="text-xs text-[var(--color-text-muted)]">No ratings</span>;
  }
  return (
    <span className="flex items-center gap-1 text-sm">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="font-medium">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function MarketplacePage() {
  const router = useRouter();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [category, setCategory] = useState('');

  const fetchListings = useCallback(async (currentPage: number, currentSearch: string, currentDomain: string, currentCategory: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('pageSize', String(PAGE_SIZE));
      if (currentSearch) params.set('search', currentSearch);
      if (currentDomain) params.set('domain', currentDomain);
      if (currentCategory) params.set('category', currentCategory);

      const res = await apiClient.get<PaginatedResponse<MarketplaceListing>>(
        `/marketplace?${params.toString()}`,
      );
      if (res.success && res.data) {
        setListings(res.data.data);
        setTotalPages(res.data.totalPages ?? 1);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings(page, search, domain, category);
  }, [page, search, domain, category, fetchListings]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchListings(1, search, domain, category);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SOP Marketplace</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Browse and install community SOPs for your surrogates
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2" style={{ minWidth: '240px' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input
              placeholder="Search SOPs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" size="sm">Search</Button>
        </form>

        <select
          value={domain}
          onChange={(e) => { setDomain(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
        >
          {DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <Input
          placeholder="Category..."
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="w-40"
        />
      </div>

      {/* Listings */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : listings.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <Store className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No listings found
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Try adjusting your search or filters
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <Card
                key={listing.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/marketplace/${listing.id}`)}
              >
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-1">
                      {listing.sopTitle}
                    </h3>
                    <Badge variant="default" className="shrink-0 text-xs capitalize">
                      {listing.domain}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                    {listing.sopDescription}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3">
                      <StarRating rating={listing.avgRating} />
                      <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        <Download className="h-3 w-3" />
                        {listing.installCount}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {listing.price === 0 ? 'Free' : `$${listing.price.toFixed(2)}`}
                    </span>
                  </div>
                  {listing.tags && listing.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {listing.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="muted" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                      {listing.tags.length > 3 && (
                        <Badge variant="muted" className="text-[10px]">
                          +{listing.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
