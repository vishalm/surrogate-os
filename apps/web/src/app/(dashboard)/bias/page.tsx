'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, AlertTriangle, Activity, Calendar } from 'lucide-react';
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
import type { PaginatedResponse, BiasCheck } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

interface DashboardData {
  totalChecks: number;
  latestCheckDate: string | null;
  avgBiasScore: number | null;
  totalAnomalies: number;
  decisionDistribution: {
    surrogateId: string;
    totalDecisions: number;
    avgConfidence: number;
    decisionsWithOutcomes: number;
  }[];
  topRecommendations: Record<string, unknown>[];
}

interface AnomalyItem {
  category: string;
  description: string;
  severity: string;
  evidence: string;
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

export default function BiasAuditDashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [checks, setChecks] = useState<BiasCheck[]>([]);
  const [anomalyChecks, setAnomalyChecks] = useState<BiasCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const [dashRes, checksRes, anomaliesRes] = await Promise.all([
        apiClient.get<DashboardData>('/bias/dashboard'),
        apiClient.get<PaginatedResponse<BiasCheck>>(
          `/bias/checks?page=${currentPage}&pageSize=${PAGE_SIZE}`,
        ),
        apiClient.get<BiasCheck[]>('/bias/anomalies'),
      ]);

      if (dashRes.success && dashRes.data) {
        setDashboard(dashRes.data);
      }
      if (checksRes.success && checksRes.data) {
        setChecks(checksRes.data.data);
        setTotalPages(checksRes.data.totalPages ?? 1);
      }
      if (anomaliesRes.success && anomaliesRes.data) {
        setAnomalyChecks(anomaliesRes.data);
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

  async function handleTriggerCheck() {
    setTriggering(true);
    try {
      await apiClient.post('/bias/check', {});
      await fetchData(page);
    } catch {
      // Error handled by API client
    } finally {
      setTriggering(false);
    }
  }

  // Collect all anomalies from anomaly checks
  const activeAnomalies: (AnomalyItem & { checkId: string })[] = anomalyChecks
    .flatMap((c) =>
      (c.anomalies as unknown as AnomalyItem[]).map((a) => ({ ...a, checkId: c.id })),
    )
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bias Audit Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Monitor and analyze decision patterns for potential bias across your surrogate fleet
          </p>
        </div>
        <Button onClick={handleTriggerCheck} disabled={triggering}>
          {triggering ? 'Running...' : 'Run Bias Check'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
                  <ShieldCheck className="h-5 w-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Total Checks</p>
                  <p className="text-xl font-bold">{dashboard?.totalChecks ?? 0}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${biasScoreBgColor(dashboard?.avgBiasScore ?? null)}`}>
                  <Activity className={`h-5 w-5 ${biasScoreColor(dashboard?.avgBiasScore ?? null)}`} />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Avg Bias Score</p>
                  <p className={`text-xl font-bold ${biasScoreColor(dashboard?.avgBiasScore ?? null)}`}>
                    {dashboard?.avgBiasScore !== null && dashboard?.avgBiasScore !== undefined
                      ? dashboard.avgBiasScore.toFixed(2)
                      : '-'}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Total Anomalies</p>
                  <p className="text-xl font-bold">{dashboard?.totalAnomalies ?? 0}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)]">
                  <Calendar className="h-5 w-5 text-[var(--color-text-muted)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Latest Check</p>
                  <p className="text-sm font-medium">
                    {dashboard?.latestCheckDate
                      ? new Date(dashboard.latestCheckDate).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Active Anomalies */}
          {activeAnomalies.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Active Anomalies</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {activeAnomalies.map((anomaly, idx) => (
                  <Card key={`${anomaly.checkId}-${idx}`}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                          {anomaly.category.replace(/_/g, ' ')}
                        </span>
                        <Badge variant={severityVariant(anomaly.severity)}>
                          {anomaly.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--color-text-primary)]">
                        {anomaly.description}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Recent Checks Table */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Recent Checks</h2>
            <Card padding={false}>
              {checks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
                    <ShieldCheck className="h-6 w-6 text-[var(--color-text-muted)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    No bias checks run yet
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Run a fleet-wide bias check to analyze decision patterns
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scope</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Bias Score</TableHead>
                        <TableHead>Anomalies</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checks.map((check) => {
                        const anomalyCount = Array.isArray(check.anomalies) ? check.anomalies.length : 0;
                        return (
                          <TableRow
                            key={check.id}
                            onClick={() => router.push(`/bias/${check.id}`)}
                          >
                            <TableCell>
                              {check.surrogateId ? (
                                <span className="font-mono text-xs">
                                  {check.surrogateId.slice(0, 8)}...
                                </span>
                              ) : (
                                <span className="text-sm font-medium">Fleet-wide</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={check.status} />
                            </TableCell>
                            <TableCell>
                              <span className={`font-mono text-sm font-bold ${biasScoreColor(check.confidence)}`}>
                                {check.confidence !== null ? check.confidence.toFixed(2) : '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {anomalyCount}
                              </span>
                            </TableCell>
                            <TableCell>
                              {new Date(check.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
        </>
      )}
    </div>
  );
}
