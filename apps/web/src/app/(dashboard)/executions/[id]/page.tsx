'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Pause,
  Play,
  XCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { Card, Button, Badge, StatusBadge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import ExecutionGraph from '@/components/execution-graph';
import type { SOPGraph, SOPNode } from '@surrogate-os/shared';

const POLL_INTERVAL = 5_000;

interface ExecutionData {
  id: string;
  sessionId: string | null;
  surrogateId: string;
  sopId: string;
  currentNodeId: string;
  visitedNodes: string[];
  decisions: DecisionItem[];
  status: string;
  context: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

interface DecisionItem {
  nodeId: string;
  edgeId: string;
  decision: string;
  confidence: number;
  timestamp: string;
  input?: Record<string, unknown>;
}

interface TransitionData {
  transitions: {
    edgeId: string;
    label: string | null;
    condition: string | null;
    targetNodeId: string;
    targetNodeLabel: string | null;
    targetNodeType: string | null;
  }[];
  progress: {
    visited: number;
    total: number;
    percentage: number;
  };
  requiresEscalation: boolean;
  isCheckpoint: boolean;
  currentNodeId: string;
  currentNodeLabel: string | null;
  currentNodeType: string | null;
}

interface TimelineData {
  executionId: string;
  sopId: string;
  surrogateId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  timeline: {
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    edgeId: string;
    edgeLabel: string | null;
    targetNodeId: string | null;
    targetNodeLabel: string | null;
    decision: string;
    confidence: number;
    timestamp: string;
    input?: Record<string, unknown>;
  }[];
}

interface SOPData {
  id: string;
  title: string;
  graph: SOPGraph;
}

interface SurrogateData {
  id: string;
  roleTitle: string;
  domain: string;
}

export default function ExecutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params.id as string;

  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [transitions, setTransitions] = useState<TransitionData | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [sop, setSop] = useState<SOPData | null>(null);
  const [surrogate, setSurrogate] = useState<SurrogateData | null>(null);
  const [loading, setLoading] = useState(true);

  // Decision input state
  const [decisionText, setDecisionText] = useState('');
  const [advancing, setAdvancing] = useState(false);

  // Escalation state
  const [escalationReason, setEscalationReason] = useState('');
  const [escalating, setEscalating] = useState(false);

  // Abort state
  const [showAbort, setShowAbort] = useState(false);
  const [abortReason, setAbortReason] = useState('');
  const [aborting, setAborting] = useState(false);

  const fetchExecution = useCallback(async () => {
    try {
      const res = await apiClient.get<ExecutionData>(`/executions/${executionId}`);
      if (res.success && res.data) {
        setExecution(res.data);
        return res.data;
      }
    } catch {
      // ignore
    }
    return null;
  }, [executionId]);

  const fetchTransitions = useCallback(async () => {
    try {
      const res = await apiClient.get<TransitionData>(`/executions/${executionId}/transitions`);
      if (res.success && res.data) {
        setTransitions(res.data);
      }
    } catch {
      // ignore
    }
  }, [executionId]);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await apiClient.get<TimelineData>(`/executions/${executionId}/timeline`);
      if (res.success && res.data) {
        setTimeline(res.data);
      }
    } catch {
      // ignore
    }
  }, [executionId]);

  const fetchSOP = useCallback(async (sopId: string) => {
    try {
      const res = await apiClient.get<SOPData>(`/sops/${sopId}`);
      if (res.success && res.data) {
        setSop(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSurrogate = useCallback(async (surrogateId: string) => {
    try {
      const res = await apiClient.get<SurrogateData>(`/surrogates/${surrogateId}`);
      if (res.success && res.data) {
        setSurrogate(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const exec = await fetchExecution();
      if (exec) {
        await Promise.all([
          fetchTransitions(),
          fetchTimeline(),
          fetchSOP(exec.sopId),
          fetchSurrogate(exec.surrogateId),
        ]);
      }
      setLoading(false);
    };
    load();
  }, [executionId, fetchExecution, fetchTransitions, fetchTimeline, fetchSOP, fetchSurrogate]);

  // Poll for updates on active executions
  useEffect(() => {
    if (!execution) return;
    if (execution.status === 'COMPLETED' || execution.status === 'ABORTED') return;

    const interval = setInterval(() => {
      fetchExecution();
      fetchTransitions();
      fetchTimeline();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [execution?.status, fetchExecution, fetchTransitions, fetchTimeline]);

  const handleAdvance = async (edgeId: string) => {
    if (!decisionText.trim() && transitions && transitions.transitions.length > 1) {
      // Use edge label as default decision text
      const edge = transitions.transitions.find((t) => t.edgeId === edgeId);
      if (edge?.label) {
        setDecisionText(edge.label);
      }
    }

    setAdvancing(true);
    try {
      const res = await apiClient.post<ExecutionData>(`/executions/${executionId}/advance`, {
        edgeId,
        decision: decisionText.trim() || transitions?.transitions.find((t) => t.edgeId === edgeId)?.label || 'proceed',
        confidence: 1.0,
      });
      if (res.success && res.data) {
        setExecution(res.data);
        setDecisionText('');
        await Promise.all([fetchTransitions(), fetchTimeline()]);
      }
    } catch {
      // ignore
    } finally {
      setAdvancing(false);
    }
  };

  const handlePause = async () => {
    const res = await apiClient.patch<ExecutionData>(`/executions/${executionId}/pause`);
    if (res.success && res.data) {
      setExecution(res.data);
      await fetchTransitions();
    }
  };

  const handleResume = async () => {
    const res = await apiClient.patch<ExecutionData>(`/executions/${executionId}/resume`);
    if (res.success && res.data) {
      setExecution(res.data);
      await fetchTransitions();
    }
  };

  const handleAbort = async () => {
    if (!abortReason.trim()) return;
    setAborting(true);
    try {
      const res = await apiClient.post<ExecutionData>(`/executions/${executionId}/abort`, {
        reason: abortReason,
      });
      if (res.success && res.data) {
        setExecution(res.data);
        setShowAbort(false);
        setAbortReason('');
        await Promise.all([fetchTransitions(), fetchTimeline()]);
      }
    } catch {
      // ignore
    } finally {
      setAborting(false);
    }
  };

  const handleEscalate = async () => {
    if (!escalationReason.trim()) return;
    setEscalating(true);
    try {
      const res = await apiClient.post<ExecutionData>(`/executions/${executionId}/escalate`, {
        reason: escalationReason,
      });
      if (res.success && res.data) {
        setExecution(res.data);
        setEscalationReason('');
        await Promise.all([fetchTransitions(), fetchTimeline()]);
      }
    } catch {
      // ignore
    } finally {
      setEscalating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Execution not found</p>
      </div>
    );
  }

  const isActive = !['COMPLETED', 'ABORTED'].includes(execution.status);
  const isPaused = execution.status === 'PAUSED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/executions')}
            className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">
                {sop?.title ?? 'Execution'}
              </h1>
              <StatusBadge status={execution.status} />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {surrogate?.roleTitle ?? ''} &middot; Started {new Date(execution.startedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Controls */}
        {isActive && (
          <div className="flex items-center gap-2">
            {isPaused ? (
              <Button variant="secondary" size="sm" onClick={handleResume}>
                <Play className="mr-1 h-3 w-3" />
                Resume
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={handlePause}>
                <Pause className="mr-1 h-3 w-3" />
                Pause
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => setShowAbort(true)}>
              <XCircle className="mr-1 h-3 w-3" />
              Abort
            </Button>
          </div>
        )}
      </div>

      {/* Progress */}
      {transitions && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Progress
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {transitions.progress.visited} of {transitions.progress.total} nodes visited
              </p>
            </div>
            <span className="text-2xl font-bold text-[var(--color-primary)]">
              {transitions.progress.percentage}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
              style={{ width: `${transitions.progress.percentage}%` }}
            />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Graph Column */}
        <div className="lg:col-span-2">
          {/* Escalation Alert */}
          {transitions?.requiresEscalation && isActive && (
            <Card className="mb-4 border-red-500/30 bg-red-500/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-600">Escalation Required</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    This node requires human review before proceeding.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={escalationReason}
                      onChange={(e) => setEscalationReason(e.target.value)}
                      placeholder="Escalation reason..."
                      className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
                    />
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={handleEscalate}
                      disabled={!escalationReason.trim() || escalating}
                    >
                      {escalating ? 'Escalating...' : 'Escalate'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Decision Input */}
          {isActive && !isPaused && transitions && transitions.transitions.length > 0 && (
            <Card className="mb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Current: {transitions.currentNodeLabel ?? transitions.currentNodeId}
              </h3>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {transitions.transitions.length === 1
                  ? 'One available path. Click to proceed.'
                  : `${transitions.transitions.length} available paths. Choose a direction.`}
              </p>

              <div className="mt-3">
                <input
                  type="text"
                  value={decisionText}
                  onChange={(e) => setDecisionText(e.target.value)}
                  placeholder="Decision rationale (optional)..."
                  className="mb-3 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                />
                <div className="flex flex-wrap gap-2">
                  {transitions.transitions.map((t) => (
                    <Button
                      key={t.edgeId}
                      size="sm"
                      variant={transitions.transitions.length === 1 ? 'primary' : 'secondary'}
                      onClick={() => handleAdvance(t.edgeId)}
                      disabled={advancing}
                    >
                      <ChevronRight className="mr-1 h-3 w-3" />
                      {t.label ?? t.condition ?? t.targetNodeLabel ?? 'Proceed'}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* SOP Graph with Execution State */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
              Execution Flow
            </h2>
            {sop ? (
              <ExecutionGraph
                graph={sop.graph}
                currentNodeId={execution.currentNodeId}
                visitedNodes={execution.visitedNodes}
                availableTransitions={transitions?.transitions}
                onTransitionClick={isActive && !isPaused ? handleAdvance : undefined}
              />
            ) : (
              <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                Loading SOP graph...
              </div>
            )}
          </Card>
        </div>

        {/* Timeline Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <Card>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Execution Details
            </h3>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Status</span>
                <StatusBadge status={execution.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Surrogate</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {surrogate?.roleTitle ?? execution.surrogateId.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">SOP</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {sop?.title ?? execution.sopId.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Decisions</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {execution.decisions.length}
                </span>
              </div>
              {execution.completedAt && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Completed</span>
                  <span className="text-[var(--color-text-primary)]">
                    {new Date(execution.completedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Decision Timeline */}
          <Card>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Decision Timeline
            </h3>
            {timeline && timeline.timeline.length > 0 ? (
              <div className="mt-3 space-y-0">
                {timeline.timeline.map((entry, i) => (
                  <div key={i} className="relative pb-4 pl-6 last:pb-0">
                    {/* Vertical line */}
                    {i < timeline.timeline.length - 1 && (
                      <div className="absolute left-[9px] top-4 h-full w-px bg-[var(--color-border)]" />
                    )}
                    {/* Dot */}
                    <div className="absolute left-0 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)]">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    </div>
                    {/* Content */}
                    <div>
                      <p className="text-xs font-medium text-[var(--color-text-primary)]">
                        {entry.nodeLabel}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {entry.decision}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge variant="muted" className="text-[9px]">
                          {Math.round(entry.confidence * 100)}% confidence
                        </Badge>
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {entry.targetNodeLabel && (
                        <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                          &rarr; {entry.targetNodeLabel}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex flex-col items-center py-4">
                <Clock className="mb-2 h-5 w-5 text-[var(--color-text-muted)]" />
                <p className="text-xs text-[var(--color-text-muted)]">
                  No decisions yet
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Abort Dialog */}
      {showAbort && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Abort Execution
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              This action cannot be undone. The execution will be permanently stopped.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                Reason
              </label>
              <input
                type="text"
                value={abortReason}
                onChange={(e) => setAbortReason(e.target.value)}
                placeholder="Why is this execution being aborted?"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setShowAbort(false); setAbortReason(''); }}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleAbort}
                disabled={!abortReason.trim() || aborting}
              >
                {aborting ? 'Aborting...' : 'Abort Execution'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
