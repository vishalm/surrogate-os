'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Lightbulb, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Button, Card, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { Handoff } from '@surrogate-os/shared';

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'muted'> = {
  INITIATED: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'muted',
};

const TYPE_VARIANT: Record<string, 'info' | 'primary' | 'warning'> = {
  DIGITAL_TO_DIGITAL: 'info',
  DIGITAL_TO_HUMAN: 'primary',
  HUMAN_TO_DIGITAL: 'warning',
};

const TYPE_LABEL: Record<string, string> = {
  DIGITAL_TO_DIGITAL: 'Digital to Digital',
  DIGITAL_TO_HUMAN: 'Digital to Human',
  HUMAN_TO_DIGITAL: 'Human to Digital',
};

export default function HandoffDetailPage() {
  const params = useParams();
  const handoffId = params.id as string;

  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [contextExpanded, setContextExpanded] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await apiClient.get<Handoff>(`/handoffs/${handoffId}`);
        if (res.success && res.data) {
          setHandoff(res.data);
        }
      } catch {
        // API may not be running
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [handoffId]);

  const handleAccept = useCallback(async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await apiClient.post<Handoff>(`/handoffs/${handoffId}/accept`);
      if (res.success && res.data) {
        setHandoff(res.data);
        setMessage({ type: 'success', text: 'Handoff accepted' });
      } else {
        setMessage({ type: 'error', text: res.error?.message ?? 'Failed to accept handoff' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setActionLoading(false);
    }
  }, [handoffId]);

  const handleReject = useCallback(async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await apiClient.post<Handoff>(`/handoffs/${handoffId}/reject`);
      if (res.success && res.data) {
        setHandoff(res.data);
        setMessage({ type: 'success', text: 'Handoff rejected' });
      } else {
        setMessage({ type: 'error', text: res.error?.message ?? 'Failed to reject handoff' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setActionLoading(false);
    }
  }, [handoffId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!handoff) {
    return (
      <div className="py-24 text-center">
        <p className="text-[var(--color-text-secondary)]">Handoff not found</p>
        <Link href="/fleet/handoffs" className="mt-4 inline-block">
          <Button variant="secondary" size="sm">
            Back to Handoffs
          </Button>
        </Link>
      </div>
    );
  }

  const bundle = (handoff.contextBundle ?? {}) as Record<string, unknown>;
  const keyDecisions = (bundle.keyDecisions ?? []) as { decision: string; impact: string; status: string }[];
  const openItems = (bundle.openItems ?? []) as { item: string; priority: string; deadline: string }[];
  const recommendations = (bundle.recommendations ?? []) as { title: string; description: string; priority: string }[];
  const riskFlags = (bundle.riskFlags ?? []) as { risk: string; severity: string; mitigation: string }[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/fleet/handoffs"
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Handoff Detail</h1>
              <Badge variant={STATUS_VARIANT[handoff.status] ?? 'muted'}>
                {handoff.status}
              </Badge>
              <Badge variant={TYPE_VARIANT[handoff.type] ?? 'muted'}>
                {TYPE_LABEL[handoff.type] ?? handoff.type}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Source: {handoff.sourceSurrogateId.slice(0, 8)}... | Initiated: {new Date(handoff.initiatedAt).toLocaleString()}
            </p>
          </div>
        </div>
        {handoff.status === 'INITIATED' && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={actionLoading}
              onClick={handleReject}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Reject
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={handleAccept}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              Accept
            </Button>
          </div>
        )}
      </div>

      {/* Status message */}
      {message && (
        <div
          className={clsx(
            'rounded-lg border px-4 py-3 text-sm',
            message.type === 'success'
              ? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]'
              : 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
          )}
        >
          {message.text}
        </div>
      )}

      {/* Summary card */}
      {handoff.summary && (
        <Card header="Handoff Summary">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {handoff.summary}
          </p>
        </Card>
      )}

      {/* Key Decisions */}
      {keyDecisions.length > 0 && (
        <Card header="Key Decisions">
          <div className="space-y-3">
            {keyDecisions.map((d, i) => {
              const statusVariant =
                d.status === 'RESOLVED' ? 'success' : d.status === 'NEEDS_REVIEW' ? 'danger' : 'warning';
              return (
                <div key={i} className="rounded-lg border border-[var(--color-border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {d.decision}
                    </p>
                    <Badge variant={statusVariant}>
                      {d.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                    Impact: {d.impact}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Open Items */}
      {openItems.length > 0 && (
        <Card header="Open Items">
          <div className="space-y-3">
            {openItems.map((item, i) => {
              const priorityVariant =
                item.priority === 'HIGH' ? 'danger' : item.priority === 'MEDIUM' ? 'warning' : 'info';
              return (
                <div key={i} className="rounded-lg border border-[var(--color-border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {item.item}
                    </p>
                    <Badge variant={priorityVariant}>
                      {item.priority}
                    </Badge>
                  </div>
                  {item.deadline !== 'None' && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Deadline: {item.deadline}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card header="Recommendations">
          <div className="space-y-3">
            {recommendations.map((r, i) => {
              const priorityVariant =
                r.priority === 'HIGH' ? 'danger' : r.priority === 'MEDIUM' ? 'warning' : 'info';
              return (
                <div key={i} className="rounded-lg border border-[var(--color-border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {r.title}
                      </p>
                    </div>
                    <Badge variant={priorityVariant}>
                      {r.priority}
                    </Badge>
                  </div>
                  <p className="mt-2 ml-6 text-xs text-[var(--color-text-secondary)]">
                    {r.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Risk Flags */}
      {riskFlags.length > 0 && (
        <Card header="Risk Flags">
          <div className="space-y-3">
            {riskFlags.map((rf, i) => {
              const severityVariant =
                rf.severity === 'CRITICAL' || rf.severity === 'HIGH'
                  ? 'danger'
                  : rf.severity === 'MEDIUM'
                    ? 'warning'
                    : 'info';
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-3"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {rf.risk}
                      </p>
                      <Badge variant={severityVariant}>
                        {rf.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Mitigation: {rf.mitigation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Context Bundle — collapsible JSON */}
      <Card header="Context Bundle">
        <button
          onClick={() => setContextExpanded(!contextExpanded)}
          className="flex w-full items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {contextExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {contextExpanded ? 'Hide raw context data' : 'Show raw context data'}
        </button>
        {contextExpanded && (
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-[var(--color-bg-elevated)] p-4 text-xs text-[var(--color-text-secondary)]">
            {JSON.stringify(bundle, null, 2)}
          </pre>
        )}
      </Card>

      {/* Metadata */}
      <Card header="Metadata">
        <dl className="space-y-3">
          {[
            ['Handoff ID', handoff.id.slice(0, 16) + '...'],
            ['Source Surrogate', handoff.sourceSurrogateId.slice(0, 16) + '...'],
            ['Target Surrogate', handoff.targetSurrogateId ? handoff.targetSurrogateId.slice(0, 16) + '...' : '-'],
            ['Target Human', handoff.targetHumanId ? handoff.targetHumanId.slice(0, 16) + '...' : '-'],
            ['Type', TYPE_LABEL[handoff.type] ?? handoff.type],
            ['Status', handoff.status],
            ['Initiated By', handoff.initiatedBy.slice(0, 16) + '...'],
            ['Initiated At', new Date(handoff.initiatedAt).toLocaleString()],
            ['Accepted By', handoff.acceptedBy ? handoff.acceptedBy.slice(0, 16) + '...' : '-'],
            ['Accepted At', handoff.acceptedAt ? new Date(handoff.acceptedAt).toLocaleString() : '-'],
            ['Session ID', handoff.sessionId ? handoff.sessionId.slice(0, 16) + '...' : '-'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-sm text-[var(--color-text-muted)]">{label}</dt>
              <dd className="text-sm font-medium font-mono text-[var(--color-text-secondary)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
