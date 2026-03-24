'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Radar } from 'lucide-react';
import {
  Card,
  Badge,
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
import type { FleetStatus, PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 20;
const POLL_INTERVAL = 30_000;

interface EnrichedSurrogate {
  id: string;
  roleTitle: string;
  domain: string;
  jurisdiction: string;
  status: string;
  sessionCount: number;
  decisionCount: number;
  lastSessionAt: string | null;
}

interface ActiveSession {
  id: string;
  surrogateId: string;
  status: string;
  startedAt: string;
  roleTitle: string;
}

interface FleetAnalytics {
  totalSessions: number;
  totalDecisions: number;
  avgDecisionsPerSession: number;
  totalDebriefs: number;
  totalEscalations: number;
  topDomains: { domain: string; count: number }[];
}

export default function FleetPage() {
  const router = useRouter();
  const [status, setStatus] = useState<FleetStatus | null>(null);
  const [surrogates, setSurrogates] = useState<EnrichedSurrogate[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [analytics, setAnalytics] = useState<FleetAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<FleetStatus>('/fleet/status');
      if (res.success && res.data) {
        setStatus(res.data);
      }
    } catch {
      // API may not be running
    }
  }, []);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const res = await apiClient.get<ActiveSession[]>('/fleet/sessions/active');
      if (res.success && res.data) {
        setActiveSessions(res.data);
      }
    } catch {
      // API may not be running
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await apiClient.get<FleetAnalytics>('/fleet/analytics');
      if (res.success && res.data) {
        setAnalytics(res.data);
      }
    } catch {
      // API may not be running
    }
  }, []);

  const fetchSurrogates = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<EnrichedSurrogate>>(
        `/fleet/surrogates?page=${currentPage}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setSurrogates(res.data.data);
        setTotalPages(res.data.totalPages ?? 1);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchActiveSessions();
    fetchAnalytics();
    fetchSurrogates(page);
  }, [page, fetchStatus, fetchActiveSessions, fetchAnalytics, fetchSurrogates]);

  // 30-second polling for status refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchActiveSessions();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchActiveSessions]);

  const statusCards = [
    { label: 'Active', count: status?.active ?? 0, variant: 'success' as const },
    { label: 'Idle', count: status?.idle ?? 0, variant: 'default' as const },
    { label: 'Paused', count: status?.paused ?? 0, variant: 'warning' as const },
    { label: 'Archived', count: status?.archived ?? 0, variant: 'muted' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Fleet Management</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Monitor and manage your surrogate fleet
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statusCards.map((card) => (
          <Card key={card.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                  {card.count}
                </p>
              </div>
              <Badge variant={card.variant}>{card.label}</Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Active Sessions */}
      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Active Sessions
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {status?.activeSessions ?? 0} session{(status?.activeSessions ?? 0) !== 1 ? 's' : ''} running
          </p>
        </div>
        {activeSessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
            No active sessions
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Surrogate</TableHead>
                <TableHead>Started At</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium text-[var(--color-text-primary)]">
                    {session.roleTitle}
                  </TableCell>
                  <TableCell>
                    {new Date(session.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={session.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Fleet Analytics */}
      {analytics && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
            Fleet Analytics
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <p className="text-sm text-[var(--color-text-secondary)]">Total Sessions</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                {analytics.totalSessions}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-[var(--color-text-secondary)]">Avg Decisions/Session</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                {analytics.avgDecisionsPerSession.toFixed(1)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-[var(--color-text-secondary)]">Total Debriefs</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                {analytics.totalDebriefs}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-[var(--color-text-secondary)]">Escalations</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                {analytics.totalEscalations}
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Enriched Surrogates Table */}
      <Card padding={false}>
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Fleet Surrogates
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : surrogates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <Radar className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No surrogates in fleet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Create surrogates to populate your fleet
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Title</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Decisions</TableHead>
                  <TableHead>Last Session</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surrogates.map((s) => (
                  <TableRow
                    key={s.id}
                    onClick={() => router.push(`/fleet/${s.id}`)}
                  >
                    <TableCell className="font-medium text-[var(--color-text-primary)]">
                      {s.roleTitle}
                    </TableCell>
                    <TableCell className="capitalize">{s.domain}</TableCell>
                    <TableCell>{s.jurisdiction}</TableCell>
                    <TableCell>{s.sessionCount}</TableCell>
                    <TableCell>{s.decisionCount}</TableCell>
                    <TableCell>
                      {s.lastSessionAt
                        ? new Date(s.lastSessionAt).toLocaleDateString()
                        : '--'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 pb-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
