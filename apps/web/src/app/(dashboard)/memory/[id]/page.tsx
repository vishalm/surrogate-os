'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { MemoryEntry } from '@surrogate-os/shared';

export default function MemoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [entry, setEntry] = useState<MemoryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEntry = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<MemoryEntry>(`/memory/${id}`);
      if (res.success && res.data) {
        setEntry(res.data);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  async function handlePromote() {
    try {
      await apiClient.patch(`/memory/${id}/promote`);
      fetchEntry();
    } catch {
      // handle error
    }
  }

  async function handleArchive() {
    try {
      await apiClient.delete(`/memory/${id}`);
      router.push('/memory');
    } catch {
      // handle error
    }
  }

  function formatDate(date: string | Date | null | undefined) {
    if (!date) return '--';
    return new Date(date).toLocaleString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/memory')}
          className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Memory
        </button>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Memory entry not found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/memory')}
            className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold">Memory Detail</h1>
        </div>
        <div className="flex gap-2">
          {entry.type === 'STM' && (
            <Button variant="secondary" onClick={handlePromote}>
              Promote to LTM
            </Button>
          )}
          <Button variant="danger" onClick={handleArchive}>
            Archive
          </Button>
        </div>
      </div>

      {/* Content */}
      <Card>
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase text-[var(--color-text-muted)]">
              Content
            </h3>
            <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
              {entry.content}
            </p>
          </div>
        </div>
      </Card>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="space-y-3">
            <h3 className="text-xs font-medium uppercase text-[var(--color-text-muted)]">
              Properties
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Type
                </span>
                <Badge variant={entry.type === 'STM' ? 'warning' : 'info'}>
                  {entry.type}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Source
                </span>
                <Badge variant="muted">{entry.source}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Observation Count
                </span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {entry.observationCount}
                </span>
              </div>
              <div>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Tags
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {entry.tags.length > 0 ? (
                    entry.tags.map((tag) => (
                      <Badge key={tag} variant="default">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      No tags
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <h3 className="text-xs font-medium uppercase text-[var(--color-text-muted)]">
              Timestamps
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  First Observed
                </span>
                <span className="text-sm text-[var(--color-text-primary)]">
                  {formatDate(entry.firstObservedAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Last Observed
                </span>
                <span className="text-sm text-[var(--color-text-primary)]">
                  {formatDate(entry.lastObservedAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Expires At
                </span>
                <span className="text-sm text-[var(--color-text-primary)]">
                  {formatDate(entry.expiresAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Promoted At
                </span>
                <span className="text-sm text-[var(--color-text-primary)]">
                  {formatDate(entry.promotedAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Created At
                </span>
                <span className="text-sm text-[var(--color-text-primary)]">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Surrogate Link */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-medium uppercase text-[var(--color-text-muted)]">
              Surrogate
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {entry.surrogateId}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push(`/surrogates/${entry.surrogateId}`)}
          >
            View Surrogate
          </Button>
        </div>
      </Card>
    </div>
  );
}
