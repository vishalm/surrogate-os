'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Activity,
  Target,
  AlertTriangle,
  Clock,
  Hash,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { apiClient } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────

interface SurrogatePerformance {
  totalSessions: number;
  avgConfidence: number | null;
  escalationRate: number;
  avgSessionDurationSeconds: number | null;
  decisionsPerSession: number;
}

interface TimeSeriesPoint {
  bucket: string;
  count: number;
}

interface HeatmapPoint {
  hour: number;
  count: number;
}

// ── Constants ────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '7d', value: '7', period: 'day' },
  { label: '30d', value: '30', period: 'day' },
  { label: '90d', value: '90', period: 'week' },
] as const;

function formatBucket(dateStr: string, period: string) {
  const d = new Date(dateStr);
  if (period === 'week') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatHour(h: number) {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

const HEATMAP_COLORS = [
  'bg-[var(--color-bg-elevated)]',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-300 dark:bg-emerald-800',
  'bg-emerald-400 dark:bg-emerald-700',
  'bg-emerald-500 dark:bg-emerald-600',
  'bg-emerald-600 dark:bg-emerald-500',
];

function getHeatmapIntensity(count: number, maxCount: number): string {
  if (count === 0) return HEATMAP_COLORS[0];
  const ratio = count / maxCount;
  if (ratio <= 0.2) return HEATMAP_COLORS[1];
  if (ratio <= 0.4) return HEATMAP_COLORS[2];
  if (ratio <= 0.6) return HEATMAP_COLORS[3];
  if (ratio <= 0.8) return HEATMAP_COLORS[4];
  return HEATMAP_COLORS[5];
}

// ── Component ────────────────────────────────────────────────────────

export default function SurrogateAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const surrogateId = params.surrogateId as string;

  const [loading, setLoading] = useState(true);
  const [performance, setPerformance] = useState<SurrogatePerformance | null>(null);
  const [sessionTrend, setSessionTrend] = useState<TimeSeriesPoint[]>([]);
  const [decisionTrend, setDecisionTrend] = useState<TimeSeriesPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[1]); // 30d

  const fetchPerformance = useCallback(async () => {
    try {
      const res = await apiClient.get<SurrogatePerformance>(
        `/analytics/surrogates/${surrogateId}/performance`,
      );
      if (res.success && res.data) setPerformance(res.data);
    } catch {
      // API may not be running
    }
  }, [surrogateId]);

  const fetchHeatmap = useCallback(async () => {
    try {
      const res = await apiClient.get<HeatmapPoint[]>(
        `/analytics/decision-heatmap?surrogateId=${surrogateId}`,
      );
      if (res.success && res.data) setHeatmap(res.data);
    } catch {
      // API may not be running
    }
  }, [surrogateId]);

  const fetchTrends = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - Number(selectedPeriod.value));

    const startStr = encodeURIComponent(start.toISOString());
    const endStr = encodeURIComponent(end.toISOString());
    const period = selectedPeriod.period;

    try {
      const [sessRes, decRes] = await Promise.all([
        apiClient.get<TimeSeriesPoint[]>(
          `/analytics/time-series?metric=sessions_created&period=${period}&start=${startStr}&end=${endStr}`,
        ),
        apiClient.get<TimeSeriesPoint[]>(
          `/analytics/time-series?metric=decisions_made&period=${period}&start=${startStr}&end=${endStr}`,
        ),
      ]);

      if (sessRes.success && sessRes.data) setSessionTrend(sessRes.data);
      if (decRes.success && decRes.data) setDecisionTrend(decRes.data);
    } catch {
      // API may not be running
    }
  }, [selectedPeriod]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchPerformance(), fetchHeatmap()]);
      setLoading(false);
    }
    init();
  }, [fetchPerformance, fetchHeatmap]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const maxSessionCount = Math.max(1, ...sessionTrend.map((p) => p.count));
  const maxDecisionCount = Math.max(1, ...decisionTrend.map((p) => p.count));
  const maxHeatmapCount = Math.max(1, ...heatmap.map((p) => p.count));

  const perfCards = [
    {
      label: 'Total Sessions',
      value: performance?.totalSessions ?? 0,
      icon: Activity,
      color: 'var(--color-primary)',
    },
    {
      label: 'Avg Confidence',
      value:
        performance?.avgConfidence !== null && performance?.avgConfidence !== undefined
          ? `${(performance.avgConfidence * 100).toFixed(0)}%`
          : '--',
      icon: Target,
      color: 'var(--color-success)',
    },
    {
      label: 'Escalation Rate',
      value: `${performance?.escalationRate ?? 0}%`,
      icon: AlertTriangle,
      color: 'var(--color-warning)',
    },
    {
      label: 'Avg Duration',
      value: formatDuration(performance?.avgSessionDurationSeconds ?? null),
      icon: Clock,
      color: 'var(--color-accent)',
    },
    {
      label: 'Decisions/Session',
      value: performance?.decisionsPerSession ?? 0,
      icon: Hash,
      color: 'var(--color-info, #3b82f6)',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/analytics')}
          className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Surrogate Analytics</h1>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)] font-mono">
            {surrogateId}
          </p>
        </div>
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {perfCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${card.color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color: card.color }} />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">{card.label}</p>
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">
                    {loading ? (
                      <span className="inline-block h-5 w-10 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
                    ) : (
                      card.value
                    )}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Period Selector */}
      <div className="flex justify-end">
        <div className="flex rounded-md border border-[var(--color-border)]">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.label}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedPeriod.label === p.label
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
              } ${p.label === '7d' ? 'rounded-l-md' : ''} ${p.label === '90d' ? 'rounded-r-md' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Session History Trend */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          Session History
        </h2>
        {sessionTrend.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            No session data for this period
          </p>
        ) : (
          <div className="space-y-2">
            {sessionTrend.map((point) => (
              <div key={point.bucket} className="flex items-center gap-3">
                <span className="w-20 flex-shrink-0 text-xs text-[var(--color-text-muted)]">
                  {formatBucket(point.bucket, selectedPeriod.period)}
                </span>
                <div className="flex-1">
                  <div
                    className="h-5 rounded-r bg-[var(--color-primary)] transition-all"
                    style={{ width: `${Math.max(2, (point.count / maxSessionCount) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-medium text-[var(--color-text-primary)]">
                  {point.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Decision Patterns */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          Decision Patterns
        </h2>
        {decisionTrend.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            No decision data for this period
          </p>
        ) : (
          <div className="space-y-2">
            {decisionTrend.map((point) => (
              <div key={point.bucket} className="flex items-center gap-3">
                <span className="w-20 flex-shrink-0 text-xs text-[var(--color-text-muted)]">
                  {formatBucket(point.bucket, selectedPeriod.period)}
                </span>
                <div className="flex-1">
                  <div
                    className="h-5 rounded-r bg-[var(--color-accent)] transition-all"
                    style={{ width: `${Math.max(2, (point.count / maxDecisionCount) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-medium text-[var(--color-text-primary)]">
                  {point.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Decision Heatmap */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          Decision Heatmap (24h)
        </h2>
        <div className="grid grid-cols-24 gap-1">
          {heatmap.map((point) => (
            <div key={point.hour} className="flex flex-col items-center gap-1">
              <div
                className={`h-8 w-full rounded ${getHeatmapIntensity(point.count, maxHeatmapCount)}`}
                title={`${formatHour(point.hour)}: ${point.count} decisions`}
              />
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {point.hour % 3 === 0 ? formatHour(point.hour) : ''}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>Less</span>
          {HEATMAP_COLORS.map((cls, i) => (
            <div key={i} className={`h-3 w-3 rounded ${cls}`} />
          ))}
          <span>More</span>
        </div>
      </Card>
    </div>
  );
}
