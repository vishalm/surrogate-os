'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Bot,
  GitBranch,
  Brain,
  User,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { Card, Button, StatusBadge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { AuditAction } from '@surrogate-os/shared';
import type { PaginatedResponse, Surrogate } from '@surrogate-os/shared';

// ── Types ──────────────────────────────────────────────────

interface ActivityFeedItem {
  id: string;
  surrogateId: string | null;
  userId: string | null;
  action: string;
  details: Record<string, unknown>;
  description: string;
  actorName: string | null;
  createdAt: string;
}

interface ActivityStats {
  period: string;
  totalActions: number;
  actionCounts: Record<string, number>;
  mostActiveSurrogate: { id: string; name: string; count: number } | null;
}

// ── Action icon / color mapping ────────────────────────────

function getActionIcon(action: string) {
  if (action.startsWith('SURROGATE_')) return Bot;
  if (action.startsWith('SOP_')) return GitBranch;
  if (action.startsWith('MEMORY_')) return Brain;
  if (action.startsWith('USER_') || action.startsWith('MEMBER_')) return User;
  if (action.startsWith('BIAS_') || action.startsWith('COMPLIANCE_')) return Shield;
  if (action.startsWith('ESCALATION_') || action.startsWith('HANDOFF_')) return Zap;
  return Activity;
}

function getActionColor(action: string): string {
  if (action.includes('CREATED') || action.includes('REGISTERED'))
    return 'bg-emerald-500/15 text-emerald-400';
  if (action.includes('UPDATED') || action.includes('PROMOTED'))
    return 'bg-blue-500/15 text-blue-400';
  if (action.includes('DELETED') || action.includes('ARCHIVED') || action.includes('DEPRECATED'))
    return 'bg-red-500/15 text-red-400';
  if (action.includes('CERTIFIED') || action.includes('APPROVED') || action.includes('COMPLETED'))
    return 'bg-violet-500/15 text-violet-400';
  if (action.includes('REJECTED') || action.includes('KILL_SWITCH'))
    return 'bg-orange-500/15 text-orange-400';
  if (action.includes('TRIGGERED') || action.includes('ESCALATION'))
    return 'bg-amber-500/15 text-amber-400';
  return 'bg-slate-500/15 text-slate-400';
}

// ── Relative time ──────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Page ───────────────────────────────────────────────────

export default function ActivityPage() {
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [todayStats, setTodayStats] = useState<ActivityStats | null>(null);
  const [surrogates, setSurrogates] = useState<Surrogate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterSurrogate, setFilterSurrogate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (filterAction) params.set('action', filterAction);
      if (filterSurrogate) params.set('surrogateId', filterSurrogate);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);

      const res = await apiClient.get<PaginatedResponse<ActivityFeedItem>>(
        `/activity/feed?${params.toString()}`,
      );
      if (res.success && res.data) {
        setFeed(res.data.data);
        setTotalPages(res.data.totalPages);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterSurrogate, filterStartDate, filterEndDate]);

  const fetchStats = useCallback(async () => {
    try {
      const [weekRes, todayRes] = await Promise.all([
        apiClient.get<ActivityStats>('/activity/stats?period=week'),
        apiClient.get<ActivityStats>('/activity/stats?period=today'),
      ]);
      if (weekRes.success && weekRes.data) setStats(weekRes.data);
      if (todayRes.success && todayRes.data) setTodayStats(todayRes.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    async function fetchSurrogates() {
      try {
        const res = await apiClient.get<PaginatedResponse<Surrogate>>(
          '/surrogates?pageSize=100',
        );
        if (res.success && res.data) setSurrogates(res.data.data);
      } catch {
        // ignore
      }
    }
    fetchSurrogates();
  }, []);

  const actionTypes = Object.values(AuditAction);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Real-time activity timeline across all modules
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
              <Zap className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Today</p>
              <p className="text-xl font-bold">{todayStats?.totalActions ?? 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">This Week</p>
              <p className="text-xl font-bold">{stats?.totalActions ?? 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
              <Activity className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Action Types</p>
              <p className="text-xl font-bold">
                {stats ? Object.keys(stats.actionCounts).length : 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
              <Bot className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Most Active</p>
              <p className="truncate text-sm font-bold">
                {stats?.mostActiveSurrogate?.name ?? 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Toggle + Controls */}
      <Card>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {(filterAction || filterSurrogate || filterStartDate || filterEndDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterAction('');
                setFilterSurrogate('');
                setFilterStartDate('');
                setFilterEndDate('');
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                Action Type
              </label>
              <select
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                <option value="">All Actions</option>
                {actionTypes.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                Surrogate
              </label>
              <select
                value={filterSurrogate}
                onChange={(e) => { setFilterSurrogate(e.target.value); setPage(1); }}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                <option value="">All Surrogates</option>
                {surrogates.map((s) => (
                  <option key={s.id} value={s.id}>{s.roleTitle}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                Start Date
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                End Date
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Activity Timeline */}
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : feed.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">
            No activity found
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {feed.map((item) => {
              const Icon = getActionIcon(item.action);
              const colorClass = getActionColor(item.action);

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-bg-elevated)]"
                >
                  {/* Icon */}
                  <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {item.actorName ?? 'System'}
                      </span>
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {item.description}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.action.replace(/_/g, ' ')} />
                      {item.surrogateId && (
                        <span className="rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                          {item.surrogateId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <Clock className="h-3 w-3" />
                    {relativeTime(item.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
