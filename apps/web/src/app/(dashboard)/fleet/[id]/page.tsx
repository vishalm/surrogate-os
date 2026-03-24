'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

interface SurrogateHealth {
  surrogateId: string;
  roleTitle: string;
  totalSessions: number;
  totalDecisions: number;
  avgConfidence: number | null;
  escalationCount: number;
  lastSessionAt: string | null;
}

export default function FleetSurrogateHealthPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [health, setHealth] = useState<SurrogateHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<SurrogateHealth>(
        `/fleet/surrogates/${id}/health`,
      );
      if (res.success && res.data) {
        setHealth(res.data);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/fleet')}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Fleet
        </button>
        <p className="text-sm text-[var(--color-text-muted)]">
          Surrogate not found
        </p>
      </div>
    );
  }

  const metrics = [
    { label: 'Total Sessions', value: health.totalSessions },
    { label: 'Total Decisions', value: health.totalDecisions },
    {
      label: 'Avg Confidence',
      value: health.avgConfidence != null
        ? `${(health.avgConfidence * 100).toFixed(1)}%`
        : '--',
    },
    { label: 'Escalations', value: health.escalationCount },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/fleet')}
            className="flex items-center justify-center rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {health.roleTitle}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Surrogate Health Metrics
            </p>
          </div>
        </div>
        <Link href={`/surrogates/${health.surrogateId}`}>
          <Button size="sm">
            <span className="flex items-center gap-2">
              View Surrogate
              <ExternalLink className="h-3 w-3" />
            </span>
          </Button>
        </Link>
      </div>

      {/* Health Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {metric.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
              {metric.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Last Session Info */}
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
          Last Session
        </h2>
        {health.lastSessionAt ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {new Date(health.lastSessionAt).toLocaleString()}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            No sessions recorded yet
          </p>
        )}
      </Card>
    </div>
  );
}
