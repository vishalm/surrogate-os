'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Bot,
  FileText,
  Activity,
  Target,
  ShieldCheck,
  Download,
  Lightbulb,
  AlertTriangle,
  Info,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────

interface DashboardMetrics {
  totalSurrogates: number;
  totalSOPs: number;
  totalSessions: number;
  totalDecisions: number;
  avgConfidence: number | null;
  complianceScore: number | null;
}

interface TimeSeriesPoint {
  bucket: string;
  count: number;
}

interface DomainBreakdown {
  domain: string;
  surrogateCount: number;
  activeCount: number;
  totalSessions: number;
  totalDecisions: number;
}

interface HeatmapPoint {
  hour: number;
  count: number;
}

interface Insight {
  type: string;
  title: string;
  description: string;
}

// ── Constants ────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { label: string; value: string; period: string }[] = [
  { label: '7d', value: '7', period: 'day' },
  { label: '30d', value: '30', period: 'day' },
  { label: '90d', value: '90', period: 'week' },
  { label: '1y', value: '365', period: 'month' },
];

const METRIC_OPTIONS: { label: string; value: string }[] = [
  { label: 'Sessions Created', value: 'sessions_created' },
  { label: 'Decisions Made', value: 'decisions_made' },
  { label: 'SOPs Generated', value: 'sops_generated' },
  { label: 'Compliance Checks', value: 'compliance_checks' },
  { label: 'Executions Completed', value: 'executions_completed' },
];

const INSIGHT_ICONS: Record<string, typeof Lightbulb> = {
  trend: TrendingUp,
  status: Activity,
  metric: Zap,
  alert: AlertTriangle,
  info: Info,
};

const HEATMAP_COLORS = [
  'bg-[var(--color-bg-elevated)]',
  'bg-blue-200 dark:bg-blue-900',
  'bg-blue-300 dark:bg-blue-800',
  'bg-blue-400 dark:bg-blue-700',
  'bg-blue-500 dark:bg-blue-600',
  'bg-blue-600 dark:bg-blue-500',
];

// ── Helpers ──────────────────────────────────────────────────────────

function getDateRange(daysBack: string) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Number(daysBack));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatBucket(dateStr: string, period: string) {
  const d = new Date(dateStr);
  if (period === 'month') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  if (period === 'week') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getHeatmapIntensity(count: number, maxCount: number): string {
  if (count === 0) return HEATMAP_COLORS[0];
  const ratio = count / maxCount;
  if (ratio <= 0.2) return HEATMAP_COLORS[1];
  if (ratio <= 0.4) return HEATMAP_COLORS[2];
  if (ratio <= 0.6) return HEATMAP_COLORS[3];
  if (ratio <= 0.8) return HEATMAP_COLORS[4];
  return HEATMAP_COLORS[5];
}

function formatHour(h: number) {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

// ── Component ────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [domains, setDomains] = useState<DomainBreakdown[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[1]); // 30d
  const [selectedMetric, setSelectedMetric] = useState(METRIC_OPTIONS[0]); // sessions_created
  const [exporting, setExporting] = useState(false);

  // Fetch dashboard metrics, domains, heatmap, insights
  const fetchCoreData = useCallback(async () => {
    try {
      const [metricsRes, domainsRes, heatmapRes, insightsRes] = await Promise.all([
        apiClient.get<DashboardMetrics>('/analytics/dashboard'),
        apiClient.get<DomainBreakdown[]>('/analytics/domains'),
        apiClient.get<HeatmapPoint[]>('/analytics/decision-heatmap'),
        apiClient.get<Insight[]>('/analytics/insights'),
      ]);

      if (metricsRes.success && metricsRes.data) setMetrics(metricsRes.data);
      if (domainsRes.success && domainsRes.data) setDomains(domainsRes.data);
      if (heatmapRes.success && heatmapRes.data) setHeatmap(heatmapRes.data);
      if (insightsRes.success && insightsRes.data) setInsights(insightsRes.data);
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch time series whenever metric/period changes
  const fetchTimeSeries = useCallback(async () => {
    try {
      const { start, end } = getDateRange(selectedPeriod.value);
      const res = await apiClient.get<TimeSeriesPoint[]>(
        `/analytics/time-series?metric=${selectedMetric.value}&period=${selectedPeriod.period}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      );
      if (res.success && res.data) setTimeSeries(res.data);
    } catch {
      // API may not be running
    }
  }, [selectedMetric, selectedPeriod]);

  useEffect(() => {
    fetchCoreData();
  }, [fetchCoreData]);

  useEffect(() => {
    fetchTimeSeries();
  }, [fetchTimeSeries]);

  // Export handler
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/analytics/export`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('sos_access_token') : ''}`,
          },
          body: JSON.stringify({ format: 'csv', filters: {} }),
        },
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // Export failed
    } finally {
      setExporting(false);
    }
  };

  // Derived values
  const maxTimeSeriesCount = Math.max(1, ...timeSeries.map((p) => p.count));
  const maxHeatmapCount = Math.max(1, ...heatmap.map((p) => p.count));
  const maxDomainDecisions = Math.max(1, ...domains.map((d) => d.totalDecisions));

  const statCards = [
    { label: 'Surrogates', value: metrics?.totalSurrogates ?? 0, icon: Bot, color: 'var(--color-primary)' },
    { label: 'SOPs', value: metrics?.totalSOPs ?? 0, icon: FileText, color: 'var(--color-accent)' },
    { label: 'Sessions', value: metrics?.totalSessions ?? 0, icon: Activity, color: 'var(--color-success)' },
    { label: 'Decisions', value: metrics?.totalDecisions ?? 0, icon: Target, color: 'var(--color-warning)' },
    {
      label: 'Avg Confidence',
      value: metrics?.avgConfidence !== null && metrics?.avgConfidence !== undefined
        ? `${(metrics.avgConfidence * 100).toFixed(0)}%`
        : '--',
      icon: BarChart3,
      color: 'var(--color-info, #3b82f6)',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Platform-wide analytics and reporting
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-elevated)] disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">
                    {loading ? (
                      <span className="inline-block h-5 w-10 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Time Series Section */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Time Series</h2>
          <div className="flex items-center gap-3">
            {/* Metric selector */}
            <select
              value={selectedMetric.value}
              onChange={(e) => {
                const found = METRIC_OPTIONS.find((m) => m.value === e.target.value);
                if (found) setSelectedMetric(found);
              }}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {/* Period selector */}
            <div className="flex rounded-md border border-[var(--color-border)]">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedPeriod.label === p.label
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                  } ${p.label === '7d' ? 'rounded-l-md' : ''} ${p.label === '1y' ? 'rounded-r-md' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {timeSeries.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            No data for the selected period
          </p>
        ) : (
          <div className="space-y-2">
            {timeSeries.map((point) => (
              <div key={point.bucket} className="flex items-center gap-3">
                <span className="w-20 flex-shrink-0 text-xs text-[var(--color-text-muted)]">
                  {formatBucket(point.bucket, selectedPeriod.period)}
                </span>
                <div className="flex-1">
                  <div
                    className="h-6 rounded-r bg-[var(--color-primary)]/20 transition-all"
                    style={{ width: `${Math.max(2, (point.count / maxTimeSeriesCount) * 100)}%` }}
                  >
                    <div
                      className="h-full rounded-r bg-[var(--color-primary)]"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <span className="w-12 text-right text-xs font-medium text-[var(--color-text-primary)]">
                  {point.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Domain Breakdown */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          Domain Breakdown
        </h2>
        {domains.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            No domain data available
          </p>
        ) : (
          <div className="space-y-3">
            {domains.map((d) => (
              <div key={d.domain} className="rounded-lg border border-[var(--color-border)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize text-[var(--color-text-primary)]">
                      {d.domain}
                    </span>
                    <Badge variant="default">{d.surrogateCount} surrogates</Badge>
                    <Badge variant="success">{d.activeCount} active</Badge>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {d.totalSessions} sessions / {d.totalDecisions} decisions
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                    style={{ width: `${Math.max(2, (d.totalDecisions / maxDomainDecisions) * 100)}%` }}
                  />
                </div>
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

      {/* Insights */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">Insights</h2>
        {insights.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            No insights available
          </p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, idx) => {
              const Icon = INSIGHT_ICONS[insight.type] ?? Lightbulb;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] p-3"
                >
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[var(--color-bg-elevated)]">
                    <Icon className="h-4 w-4 text-[var(--color-text-secondary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {insight.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {insight.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
