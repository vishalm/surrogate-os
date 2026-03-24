'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, CheckCircle, XCircle, Clock, Globe, Building } from 'lucide-react';
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
import type { PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

interface ComplianceFramework {
  id: string;
  name: string;
  jurisdiction: string;
  domain: string;
  version: string;
  requirements: { id: string; title: string; severity: string }[];
}

interface ComplianceCheck {
  id: string;
  surrogateId: string;
  frameworkId: string;
  status: string;
  results: unknown[];
  passed: number;
  failed: number;
  score: number | null;
  checkedBy: string | null;
  createdAt: string;
}

interface Surrogate {
  id: string;
  roleTitle: string;
  domain: string;
  jurisdiction: string;
  status: string;
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-[var(--color-text-muted)]';
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

function scoreBg(score: number | null): string {
  if (score === null) return 'bg-[var(--color-bg-elevated)]';
  if (score >= 80) return 'bg-green-500/10';
  if (score >= 50) return 'bg-yellow-500/10';
  return 'bg-red-500/10';
}

export default function ComplianceDashboardPage() {
  const router = useRouter();
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [surrogates, setSurrogates] = useState<Surrogate[]>([]);
  const [recentChecks, setRecentChecks] = useState<ComplianceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [selectedSurrogate, setSelectedSurrogate] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fwRes, surRes] = await Promise.all([
        apiClient.get<ComplianceFramework[]>('/compliance/frameworks'),
        apiClient.get<PaginatedResponse<Surrogate>>('/surrogates?pageSize=100'),
      ]);

      if (fwRes.success && fwRes.data) {
        setFrameworks(fwRes.data);
      }
      if (surRes.success && surRes.data) {
        setSurrogates(surRes.data.data);
        // Default to first surrogate
        if (surRes.data.data.length > 0 && !selectedSurrogate) {
          setSelectedSurrogate(surRes.data.data[0].id);
        }
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, [selectedSurrogate]);

  // Fetch checks for selected surrogate
  const fetchChecks = useCallback(async () => {
    if (!selectedSurrogate) return;
    try {
      const res = await apiClient.get<PaginatedResponse<ComplianceCheck>>(
        `/compliance/history/${selectedSurrogate}?pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setRecentChecks(res.data.data);
      }
    } catch {
      // ignore
    }
  }, [selectedSurrogate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchChecks();
  }, [fetchChecks]);

  async function handleRunCheck(frameworkId: string) {
    if (!selectedSurrogate) return;
    setRunning(frameworkId);
    try {
      await apiClient.post(`/compliance/check/${selectedSurrogate}`, { frameworkId });
      await fetchChecks();
    } catch {
      // Error handled by API client
    } finally {
      setRunning(null);
    }
  }

  const frameworkName = (id: string) => frameworks.find((f) => f.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance & Certification</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Run regulatory compliance checks and manage SOP cryptographic signing
          </p>
        </div>
        {selectedSurrogate && (
          <Button onClick={() => router.push(`/compliance/${selectedSurrogate}`)}>
            View Detail
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Surrogate Selector */}
          {surrogates.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                Surrogate:
              </label>
              <select
                value={selectedSurrogate}
                onChange={(e) => setSelectedSurrogate(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm"
              >
                {surrogates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.roleTitle} ({s.domain} / {s.jurisdiction})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Framework Cards */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Regulatory Frameworks</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {frameworks.map((fw) => (
                <Card key={fw.id}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
                          <ShieldAlert className="h-4 w-4 text-[var(--color-primary)]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">{fw.name}</h3>
                          <p className="text-xs text-[var(--color-text-muted)]">v{fw.version}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="info">
                        <Globe className="mr-1 inline h-3 w-3" />
                        {fw.jurisdiction}
                      </Badge>
                      <Badge variant="info">
                        <Building className="mr-1 inline h-3 w-3" />
                        {fw.domain}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {fw.requirements.length} requirements
                    </p>
                    <Button
                      onClick={() => handleRunCheck(fw.id)}
                      disabled={running === fw.id || !selectedSurrogate}
                      className="w-full"
                    >
                      {running === fw.id ? 'Running...' : 'Run Check'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Checks Table */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Recent Compliance Checks</h2>
            <Card padding={false}>
              {recentChecks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
                    <ShieldAlert className="h-6 w-6 text-[var(--color-text-muted)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    No compliance checks run yet
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Select a surrogate and run a framework check above
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Framework</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Passed</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentChecks.map((check) => (
                      <TableRow
                        key={check.id}
                        onClick={() => router.push(`/compliance/${check.surrogateId}`)}
                      >
                        <TableCell>
                          <span className="text-sm font-medium">
                            {frameworkName(check.frameworkId)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={check.status} />
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono text-sm font-bold ${scoreColor(check.score)}`}>
                            {check.score !== null ? `${check.score}%` : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm text-green-500">
                            <CheckCircle className="h-3.5 w-3.5" />
                            {check.passed}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm text-red-500">
                            <XCircle className="h-3.5 w-3.5" />
                            {check.failed}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(check.createdAt).toLocaleDateString()}
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
