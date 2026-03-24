'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Plus } from 'lucide-react';
import {
  Card,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  StatusBadge,
  Pagination,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 20;
const POLL_INTERVAL = 10_000;

const STATUS_TABS = ['ALL', 'RUNNING', 'PAUSED', 'AWAITING_INPUT', 'AWAITING_ESCALATION', 'COMPLETED', 'ABORTED'] as const;

interface ExecutionItem {
  id: string;
  sessionId: string | null;
  surrogateId: string;
  sopId: string;
  currentNodeId: string;
  visitedNodes: string[];
  status: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

interface SurrogateOption {
  id: string;
  roleTitle: string;
}

interface SOPOption {
  id: string;
  title: string;
  surrogateId: string;
}

export default function ExecutionsPage() {
  const router = useRouter();
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  // Start dialog state
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [surrogates, setSurrogates] = useState<SurrogateOption[]>([]);
  const [sops, setSops] = useState<SOPOption[]>([]);
  const [selectedSurrogate, setSelectedSurrogate] = useState('');
  const [selectedSop, setSelectedSop] = useState('');
  const [starting, setStarting] = useState(false);

  // Surrogate & SOP name maps
  const [surrogateMap, setSurrogateMap] = useState<Record<string, string>>({});
  const [sopMap, setSopMap] = useState<Record<string, string>>({});

  const fetchExecutions = useCallback(async (currentPage: number, status: string) => {
    setLoading(true);
    try {
      const statusFilter = status !== 'ALL' ? `&status=${status}` : '';
      const res = await apiClient.get<PaginatedResponse<ExecutionItem>>(
        `/executions?page=${currentPage}&pageSize=${PAGE_SIZE}${statusFilter}`,
      );
      if (res.success && res.data) {
        setExecutions(res.data.data);
        setTotalPages(res.data.totalPages ?? 1);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSurrogates = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<SurrogateOption>>(
        '/surrogates?pageSize=100',
      );
      if (res.success && res.data) {
        setSurrogates(res.data.data);
        const map: Record<string, string> = {};
        for (const s of res.data.data) {
          map[s.id] = s.roleTitle;
        }
        setSurrogateMap(map);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSOPs = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<SOPOption>>(
        '/sops?pageSize=100',
      );
      if (res.success && res.data) {
        setSops(res.data.data);
        const map: Record<string, string> = {};
        for (const s of res.data.data) {
          map[s.id] = s.title;
        }
        setSopMap(map);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSurrogates();
    fetchSOPs();
  }, [fetchSurrogates, fetchSOPs]);

  useEffect(() => {
    fetchExecutions(page, activeTab);
  }, [page, activeTab, fetchExecutions]);

  // Poll for running executions
  useEffect(() => {
    const interval = setInterval(() => {
      fetchExecutions(page, activeTab);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [page, activeTab, fetchExecutions]);

  const handleStart = async () => {
    if (!selectedSurrogate || !selectedSop) return;
    setStarting(true);
    try {
      const res = await apiClient.post<ExecutionItem>('/executions/start', {
        surrogateId: selectedSurrogate,
        sopId: selectedSop,
      });
      if (res.success && res.data) {
        setShowStartDialog(false);
        setSelectedSurrogate('');
        setSelectedSop('');
        router.push(`/executions/${res.data.id}`);
      }
    } catch {
      // ignore
    } finally {
      setStarting(false);
    }
  };

  const filteredSops = selectedSurrogate
    ? sops.filter((s) => s.surrogateId === selectedSurrogate)
    : sops;

  function getProgressText(visited: string[], nodeId: string) {
    return `${visited.length} nodes visited`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Executions</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Live SOP execution with real-time decision tracking
          </p>
        </div>
        <Button onClick={() => setShowStartDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Start Execution
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-[var(--color-bg-elevated)] p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {tab.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Executions Table */}
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <Play className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No executions found
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Start a new execution to begin tracking decisions
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Surrogate</TableHead>
                  <TableHead>SOP</TableHead>
                  <TableHead>Current Node</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((ex) => (
                  <TableRow
                    key={ex.id}
                    onClick={() => router.push(`/executions/${ex.id}`)}
                  >
                    <TableCell className="font-medium text-[var(--color-text-primary)]">
                      {surrogateMap[ex.surrogateId] ?? ex.surrogateId.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {sopMap[ex.sopId] ?? ex.sopId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ex.currentNodeId}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                          <div
                            className="h-full rounded-full bg-[var(--color-primary)]"
                            style={{ width: `${Math.min(100, (ex.visitedNodes.length / Math.max(ex.visitedNodes.length + 1, 2)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {ex.visitedNodes.length} nodes
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ex.status} />
                    </TableCell>
                    <TableCell className="text-xs text-[var(--color-text-muted)]">
                      {new Date(ex.startedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 pb-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>

      {/* Start Execution Dialog */}
      {showStartDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Start New Execution
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Select a surrogate and SOP to begin execution
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                  Surrogate
                </label>
                <select
                  value={selectedSurrogate}
                  onChange={(e) => {
                    setSelectedSurrogate(e.target.value);
                    setSelectedSop('');
                  }}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="">Select surrogate...</option>
                  {surrogates.map((s) => (
                    <option key={s.id} value={s.id}>{s.roleTitle}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                  SOP
                </label>
                <select
                  value={selectedSop}
                  onChange={(e) => setSelectedSop(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                  disabled={!selectedSurrogate && filteredSops.length === 0}
                >
                  <option value="">Select SOP...</option>
                  {filteredSops.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowStartDialog(false);
                  setSelectedSurrogate('');
                  setSelectedSop('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={!selectedSurrogate || !selectedSop || starting}
              >
                {starting ? 'Starting...' : 'Start Execution'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
