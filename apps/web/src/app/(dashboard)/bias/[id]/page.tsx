'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  StatusBadge,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { BiasCheck } from '@surrogate-os/shared';

interface Anomaly {
  category: string;
  description: string;
  severity: string;
  evidence: string;
}

interface Recommendation {
  title: string;
  description: string;
  priority: string;
  actionItems: string[];
}

interface Analysis {
  overallAssessment?: string;
  biasScore?: number;
  statisticalSummary?: {
    decisionCount: number;
    avgConfidence: number;
    escalationRate: number;
    outcomeDistribution: Record<string, number>;
  };
}

function biasScoreColor(score: number | null): string {
  if (score === null) return 'text-[var(--color-text-muted)]';
  if (score < 0.3) return 'text-green-500';
  if (score <= 0.6) return 'text-yellow-500';
  return 'text-red-500';
}

function biasScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-[var(--color-bg-elevated)]';
  if (score < 0.3) return 'bg-green-500/10';
  if (score <= 0.6) return 'bg-yellow-500/10';
  return 'bg-red-500/10';
}

function severityVariant(severity: string): 'danger' | 'warning' | 'info' {
  switch (severity) {
    case 'HIGH': return 'danger';
    case 'MEDIUM': return 'warning';
    default: return 'info';
  }
}

function priorityVariant(priority: string): 'danger' | 'warning' | 'info' {
  switch (priority) {
    case 'HIGH': return 'danger';
    case 'MEDIUM': return 'warning';
    default: return 'info';
  }
}

export default function BiasCheckDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [check, setCheck] = useState<BiasCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchCheck() {
      setLoading(true);
      try {
        const res = await apiClient.get<BiasCheck>(`/bias/checks/${id}`);
        if (res.success && res.data) {
          setCheck(res.data);
        }
      } catch {
        // API may not be running
      } finally {
        setLoading(false);
      }
    }
    fetchCheck();
  }, [id]);

  function toggleAnomaly(idx: number) {
    setExpandedAnomalies((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!check) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push('/bias')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Bias Audit
        </Button>
        <p className="text-sm text-[var(--color-text-muted)]">Bias check not found.</p>
      </div>
    );
  }

  const analysis = check.analysis as Analysis;
  const anomalies = (check.anomalies ?? []) as unknown as Anomaly[];
  const recommendations = (check.recommendations ?? []) as unknown as Recommendation[];
  const stats = analysis.statisticalSummary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/bias')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Bias Check Detail</h1>
            <StatusBadge status={check.status} />
            <span className={`rounded-md px-2 py-1 text-sm font-bold ${biasScoreBgColor(check.confidence)} ${biasScoreColor(check.confidence)}`}>
              Score: {check.confidence !== null ? check.confidence.toFixed(2) : 'N/A'}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {check.surrogateId
              ? `Surrogate: ${check.surrogateId}`
              : 'Fleet-wide analysis'}
            {' | '}
            Triggered by: {check.triggeredBy}
            {' | '}
            {new Date(check.createdAt).toLocaleString()}
            {check.completedAt && (
              <> | Completed: {new Date(check.completedAt).toLocaleString()}</>
            )}
          </p>
        </div>
      </div>

      {/* Overall Assessment */}
      {analysis.overallAssessment && (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Overall Assessment</h2>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
            {analysis.overallAssessment}
          </p>
        </Card>
      )}

      {/* Statistical Summary */}
      {stats && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Statistical Summary</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Decision Count</p>
              <p className="text-xl font-bold">{stats.decisionCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Avg Confidence</p>
              <p className="text-xl font-bold">
                {(stats.avgConfidence * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Escalation Rate</p>
              <p className="text-xl font-bold">
                {(stats.escalationRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          {stats.outcomeDistribution && Object.keys(stats.outcomeDistribution).length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-[var(--color-text-muted)]">Outcome Distribution</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.outcomeDistribution).map(([outcome, count]) => (
                  <span
                    key={outcome}
                    className="rounded-md bg-[var(--color-bg-elevated)] px-2 py-1 text-xs"
                  >
                    {outcome}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Anomalies ({anomalies.length})
          </h2>
          <div className="space-y-3">
            {anomalies.map((anomaly, idx) => {
              const expanded = expandedAnomalies.has(idx);
              return (
                <Card key={idx}>
                  <button
                    onClick={() => toggleAnomaly(idx)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={severityVariant(anomaly.severity)}>
                        {anomaly.severity}
                      </Badge>
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                        {anomaly.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {expanded ? (
                      <ChevronUp className="h-4 w-4 text-[var(--color-text-muted)]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
                    )}
                  </button>
                  <p className="mt-2 text-sm text-[var(--color-text-primary)]">
                    {anomaly.description}
                  </p>
                  {expanded && anomaly.evidence && (
                    <div className="mt-3 rounded-md bg-[var(--color-bg-elevated)] p-3">
                      <p className="text-xs font-medium text-[var(--color-text-muted)]">Evidence</p>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {anomaly.evidence}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Recommendations ({recommendations.length})
          </h2>
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <Card key={idx}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {rec.title}
                  </h3>
                  <Badge variant={priorityVariant(rec.priority)}>
                    {rec.priority}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {rec.description}
                </p>
                {rec.actionItems && rec.actionItems.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {rec.actionItems.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-text-muted)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Metadata</h2>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-[var(--color-text-muted)]">Check ID:</span>{' '}
            <span className="font-mono text-xs">{check.id}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Scope:</span>{' '}
            {check.surrogateId ? (
              <span className="font-mono text-xs">{check.surrogateId}</span>
            ) : (
              'Fleet-wide'
            )}
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Triggered By:</span>{' '}
            <span className="font-mono text-xs">{check.triggeredBy}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Decision Sample Size:</span>{' '}
            {check.decisionSampleSize}
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Created:</span>{' '}
            {new Date(check.createdAt).toLocaleString()}
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Completed:</span>{' '}
            {check.completedAt ? new Date(check.completedAt).toLocaleString() : 'N/A'}
          </div>
        </div>
      </Card>
    </div>
  );
}
