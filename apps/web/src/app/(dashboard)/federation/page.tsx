'use client';

import { useEffect, useState, useCallback } from 'react';
import { Network, Shield, Database, Trophy, ToggleLeft, ToggleRight } from 'lucide-react';
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
  Badge,
  Pagination,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type {
  PaginatedResponse,
  FederationContribution,
  FederationPrivacyReport,
  FederationLeaderboardEntry,
} from '@surrogate-os/shared';

const PAGE_SIZE = 20;

function PrivacyBudgetMeter({ used, total }: { used: number; total: number }) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const remaining = Math.max(0, total - used);

  let barColor = 'bg-green-500';
  if (percentage > 70) barColor = 'bg-yellow-500';
  if (percentage > 90) barColor = 'bg-red-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-muted)]">
          {used.toFixed(2)} / {total.toFixed(2)} used
        </span>
        <span className="font-medium text-[var(--color-text-secondary)]">
          {remaining.toFixed(2)} remaining
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function FederationDashboardPage() {
  const [privacyReport, setPrivacyReport] = useState<FederationPrivacyReport & { optedIn?: boolean; domains?: string[] } | null>(null);
  const [contributions, setContributions] = useState<FederationContribution[]>([]);
  const [leaderboard, setLeaderboard] = useState<FederationLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const [reportRes, contribRes, leaderboardRes] = await Promise.all([
        apiClient.get<FederationPrivacyReport & { optedIn?: boolean; domains?: string[] }>('/federation/privacy-report'),
        apiClient.get<PaginatedResponse<FederationContribution>>(
          `/federation/contributions?page=${currentPage}&pageSize=${PAGE_SIZE}`,
        ),
        apiClient.get<FederationLeaderboardEntry[]>('/federation/leaderboard'),
      ]);

      if (reportRes.success && reportRes.data) {
        setPrivacyReport(reportRes.data);
      }
      if (contribRes.success && contribRes.data) {
        setContributions(contribRes.data.data);
        setTotalPages(contribRes.data.totalPages ?? 1);
      }
      if (leaderboardRes.success && leaderboardRes.data) {
        setLeaderboard(leaderboardRes.data);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page);
  }, [page, fetchData]);

  async function handleToggleParticipation() {
    if (!privacyReport) return;
    setToggling(true);
    try {
      await apiClient.patch('/federation/participation', {
        optedIn: !privacyReport.optedIn,
      });
      await fetchData(page);
    } catch {
      // Error handled by API client
    } finally {
      setToggling(false);
    }
  }

  const isOptedIn = privacyReport?.optedIn ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Federated Learning</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Privacy-preserving cross-org learning that improves surrogates without exposing org data
          </p>
        </div>
        <Button
          onClick={handleToggleParticipation}
          disabled={toggling}
          variant={isOptedIn ? 'secondary' : 'primary'}
        >
          {isOptedIn ? (
            <>
              <ToggleRight className="mr-2 h-4 w-4" />
              {toggling ? 'Updating...' : 'Opt Out'}
            </>
          ) : (
            <>
              <ToggleLeft className="mr-2 h-4 w-4" />
              {toggling ? 'Updating...' : 'Opt In'}
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Opt-in Explanation */}
          {!isOptedIn && (
            <Card>
              <div className="flex items-start gap-4 p-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
                  <Network className="h-5 w-5 text-[var(--color-primary)]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Join the Federation Network
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    By opting in, your organization contributes anonymized, differentially-private decision patterns
                    to a shared pool. In return, you gain access to aggregate insights from all participating
                    organizations. No raw data is ever shared — only noise-protected statistics.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
                  <Network className="h-5 w-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Status</p>
                  <p className="text-sm font-bold">
                    <Badge variant={isOptedIn ? 'success' : 'muted'}>
                      {isOptedIn ? 'Active' : 'Inactive'}
                    </Badge>
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Database className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Contributions</p>
                  <p className="text-xl font-bold">{privacyReport?.contributionCount ?? 0}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Database className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Records Shared</p>
                  <p className="text-xl font-bold">{privacyReport?.totalRecordsShared ?? 0}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Shield className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Privacy Budget</p>
                  <p className="text-sm font-bold">
                    {((privacyReport?.budgetRemaining ?? 0)).toFixed(1)} remaining
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Privacy Budget Meter */}
          <Card>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--color-text-muted)]" />
                <h2 className="text-sm font-semibold">Privacy Budget</h2>
              </div>
              <PrivacyBudgetMeter
                used={privacyReport?.budgetUsed ?? 0}
                total={privacyReport?.budgetTotal ?? 10}
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                Each contribution consumes a portion of your privacy budget (epsilon).
                The budget limits how much information can be inferred about your organization's data.
              </p>
            </div>
          </Card>

          {/* Contribution History */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Contribution History</h2>
            <Card padding={false}>
              {contributions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
                    <Database className="h-6 w-6 text-[var(--color-text-muted)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    No contributions yet
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {isOptedIn
                      ? 'Submit anonymized decision data to start contributing'
                      : 'Opt in to start contributing to the federation'}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Epsilon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contributions.map((contrib) => (
                        <TableRow key={contrib.id}>
                          <TableCell>
                            <Badge variant="default" className="capitalize">
                              {contrib.domain}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {contrib.category ?? (
                              <span className="text-[var(--color-text-muted)]">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{contrib.recordCount}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{contrib.privacyEpsilon.toFixed(2)}</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={contrib.status} />
                          </TableCell>
                          <TableCell>
                            {new Date(contrib.createdAt).toLocaleDateString()}
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

          {/* Leaderboard */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Trophy className="h-5 w-5 text-amber-500" />
              Contribution Leaderboard
            </h2>
            <Card padding={false}>
              {leaderboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    No contributions in the federation yet
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Contributions</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Domains</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((entry) => (
                      <TableRow key={entry.orgHash}>
                        <TableCell>
                          <span className="text-sm font-bold">
                            {entry.rank <= 3 ? ['', '1st', '2nd', '3rd'][entry.rank] : `${entry.rank}th`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                            {entry.orgHash}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{entry.contributionCount}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{entry.totalRecords}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {entry.domains.slice(0, 3).map((d) => (
                              <Badge key={d} variant="muted" className="text-[10px] capitalize">
                                {d}
                              </Badge>
                            ))}
                            {entry.domains.length > 3 && (
                              <Badge variant="muted" className="text-[10px]">
                                +{entry.domains.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
