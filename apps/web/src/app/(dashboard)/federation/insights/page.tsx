'use client';

import { useEffect, useState, useCallback } from 'react';
import { Lightbulb, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Input,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

const DOMAIN_OPTIONS = [
  { value: '', label: 'All Domains' },
  { value: 'legal', label: 'Legal' },
  { value: 'medical', label: 'Medical' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'customer-support', label: 'Customer Support' },
];

interface PoolInsights {
  domain: string;
  category: string | null;
  totalContributions: number;
  totalRecords: number;
  insights: {
    totalRecords: number;
    avgConfidence: number | null;
    decisionDistribution: Record<string, number>;
    escalationRate: number;
    commonPatterns: { decision: string; count: number }[];
  } | null;
}

function InsightCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">{title}</p>
          <p className="text-xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function DecisionPatternChart({
  patterns,
}: {
  patterns: { decision: string; count: number }[];
}) {
  if (patterns.length === 0) return null;

  const maxCount = Math.max(...patterns.map((p) => p.count), 1);

  return (
    <div className="space-y-2">
      {patterns.map((pattern) => (
        <div key={pattern.decision} className="flex items-center gap-3">
          <span className="w-32 truncate text-xs text-[var(--color-text-secondary)]">
            {pattern.decision}
          </span>
          <div className="flex-1">
            <div className="h-5 overflow-hidden rounded bg-[var(--color-bg-elevated)]">
              <div
                className="h-full rounded bg-[var(--color-primary)]/70 transition-all"
                style={{ width: `${(pattern.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
          <span className="w-10 text-right font-mono text-xs text-[var(--color-text-muted)]">
            {pattern.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FederationInsightsPage() {
  const [insights, setInsights] = useState<PoolInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('');
  const [category, setCategory] = useState('');
  const [applying, setApplying] = useState<string | null>(null);

  const fetchInsights = useCallback(async (currentDomain: string, currentCategory: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentDomain) params.set('domain', currentDomain);
      if (currentCategory) params.set('category', currentCategory);

      const res = await apiClient.get<PoolInsights>(
        `/federation/insights?${params.toString()}`,
      );
      if (res.success && res.data) {
        setInsights(res.data);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights(domain, category);
  }, [domain, category, fetchInsights]);

  async function handleApplyToSOP(sopId: string, insightData: Record<string, unknown>[]) {
    setApplying(sopId);
    try {
      await apiClient.post(`/federation/apply/${sopId}`, {
        insights: insightData,
        rationale: `Applied federation insights from ${insights?.domain ?? 'all'} domain`,
      });
    } catch {
      // Error handled by API client
    } finally {
      setApplying(null);
    }
  }

  const data = insights?.insights;
  const decisionEntries = data?.decisionDistribution
    ? Object.entries(data.decisionDistribution)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Federation Insights</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Explore aggregate decision patterns across the federation — no org-specific data is exposed
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
        >
          {DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <Input
          placeholder="Category filter..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-48"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : !data ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <Lightbulb className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No insights available yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Insights will appear once organizations contribute data to the federation pool
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InsightCard
              title="Contributing Orgs"
              value={String(insights?.totalContributions ?? 0)}
              icon={TrendingUp}
              iconColor="bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
            />
            <InsightCard
              title="Total Records"
              value={String(data.totalRecords)}
              subtitle="Differentially private count"
              icon={TrendingUp}
              iconColor="bg-blue-500/10 text-blue-500"
            />
            <InsightCard
              title="Avg Confidence"
              value={data.avgConfidence !== null ? data.avgConfidence.toFixed(3) : '-'}
              subtitle="Noise-protected aggregate"
              icon={Lightbulb}
              iconColor="bg-green-500/10 text-green-500"
            />
            <InsightCard
              title="Escalation Rate"
              value={`${(data.escalationRate * 100).toFixed(1)}%`}
              subtitle="Across all contributors"
              icon={AlertTriangle}
              iconColor="bg-amber-500/10 text-amber-500"
            />
          </div>

          {/* Decision Patterns */}
          <Card>
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Decision Pattern Distribution</h2>
              {data.commonPatterns.length > 0 ? (
                <DecisionPatternChart patterns={data.commonPatterns} />
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">
                  No decision patterns available for the selected filters
                </p>
              )}
            </div>
          </Card>

          {/* Decision Distribution Breakdown */}
          {decisionEntries.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Detailed Distribution</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {decisionEntries.map(([decision, count]) => (
                  <Card key={decision}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                          {decision.replace(/_/g, ' ')}
                        </p>
                        <p className="mt-1 text-2xl font-bold">{count}</p>
                      </div>
                      <Badge variant="default" className="capitalize">
                        {insights?.domain ?? 'all'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Apply Insights CTA */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Apply Insights to Your SOPs</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Use federation insights to create improvement proposals for your existing SOPs.
                  Navigate to a specific SOP to apply insights.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.location.href = '/sops'}
              >
                View SOPs
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
