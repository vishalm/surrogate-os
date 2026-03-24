'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Lightbulb, ShieldAlert, Puzzle } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Button, Card, Badge, StatusBadge } from '@/components/ui';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { Session, DecisionOutcome, Debrief } from '@surrogate-os/shared';

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [decisions, setDecisions] = useState<DecisionOutcome[]>([]);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const sessionRes = await apiClient.get<Session>(`/debriefs/sessions/${sessionId}`);
        if (sessionRes.success && sessionRes.data) {
          setSession(sessionRes.data);
        }

        // Try to fetch debrief
        try {
          const debriefRes = await apiClient.get<Debrief>(`/debriefs/sessions/${sessionId}/debrief`);
          if (debriefRes.success && debriefRes.data) {
            setDebrief(debriefRes.data);
          }
        } catch {
          // No debrief yet — that is fine
        }
      } catch {
        // API may not be running
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [sessionId]);

  const handleComplete = useCallback(async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await apiClient.patch<Session>(`/debriefs/sessions/${sessionId}/complete`);
      if (res.success && res.data) {
        setSession(res.data);
        setMessage({ type: 'success', text: 'Session completed' });
      } else {
        setMessage({ type: 'error', text: res.error?.message ?? 'Failed to complete session' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setActionLoading(false);
    }
  }, [sessionId]);

  const handleGenerate = useCallback(async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await apiClient.post<Debrief>(`/debriefs/sessions/${sessionId}/generate`);
      if (res.success && res.data) {
        setDebrief(res.data);
        setMessage({ type: 'success', text: 'Debrief generated successfully' });
      } else {
        setMessage({ type: 'error', text: res.error?.message ?? 'Failed to generate debrief' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while generating debrief' });
    } finally {
      setActionLoading(false);
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-24 text-center">
        <p className="text-[var(--color-text-secondary)]">Session not found</p>
        <Link href="/debriefs" className="mt-4 inline-block">
          <Button variant="secondary" size="sm">
            Back to Debriefs
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/debriefs"
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Session Detail</h1>
              <StatusBadge status={session.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Surrogate: {session.surrogateId.slice(0, 8)}... | Started: {new Date(session.startedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.status === 'ACTIVE' && (
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={handleComplete}
            >
              Complete Session
            </Button>
          )}
          {session.status === 'COMPLETED' && !debrief && (
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={handleGenerate}
            >
              Generate Debrief
            </Button>
          )}
        </div>
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

      {/* Session metadata */}
      <Card header="Session Info">
        <dl className="space-y-3">
          {[
            ['Session ID', session.id.slice(0, 16) + '...'],
            ['Surrogate ID', session.surrogateId.slice(0, 16) + '...'],
            ['Status', session.status],
            ['Started', new Date(session.startedAt).toLocaleString()],
            ['Ended', session.endedAt ? new Date(session.endedAt).toLocaleString() : '-'],
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

      {/* Debrief display */}
      {debrief && (
        <>
          {/* Summary */}
          <Card header="Debrief Summary">
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {debrief.summary}
            </p>
          </Card>

          {/* Decision analysis */}
          {Array.isArray(debrief.decisions) && debrief.decisions.length > 0 && (
            <Card header="Decision Analysis">
              <div className="space-y-3">
                {debrief.decisions.map((d: Record<string, unknown>, i: number) => (
                  <div
                    key={i}
                    className={clsx(
                      'rounded-lg border p-3',
                      d.wasCorrect
                        ? 'border-[var(--color-success)]/20 bg-[var(--color-success)]/5'
                        : 'border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {d.description as string}
                      </p>
                      <Badge variant={d.wasCorrect ? 'success' : 'warning'}>
                        {d.outcome as string}
                      </Badge>
                    </div>
                    {typeof d.improvement === 'string' && d.improvement !== 'None' && (
                      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        Improvement: {d.improvement}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Escalations */}
          {Array.isArray(debrief.escalations) && debrief.escalations.length > 0 && (
            <Card header="Escalations">
              <div className="space-y-3">
                {debrief.escalations.map((e: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {e.reason as string}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {e.context as string}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Edge Cases */}
          {Array.isArray(debrief.edgeCases) && debrief.edgeCases.length > 0 && (
            <Card header="Edge Cases">
              <div className="space-y-3">
                {debrief.edgeCases.map((ec: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-3">
                    <Puzzle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {ec.description as string}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Suggested handling: {ec.suggestedHandling as string}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recommendations */}
          {Array.isArray(debrief.recommendations) && debrief.recommendations.length > 0 && (
            <Card header="Recommendations">
              <div className="space-y-3">
                {debrief.recommendations.map((r: Record<string, unknown>, i: number) => {
                  const priorityVariant = (r.priority as string) === 'HIGH' ? 'danger' : (r.priority as string) === 'MEDIUM' ? 'warning' : 'info';
                  return (
                    <div key={i} className="rounded-lg border border-[var(--color-border)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {r.title as string}
                          </p>
                        </div>
                        <Badge variant={priorityVariant}>
                          {r.priority as string}
                        </Badge>
                      </div>
                      <p className="mt-2 ml-6 text-xs text-[var(--color-text-secondary)]">
                        {r.description as string}
                      </p>
                      <p className="mt-1 ml-6 text-xs text-[var(--color-text-muted)]">
                        SOP Impact: {r.sopImpact as string}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
