'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileSignature,
  ArrowLeft,
  Download,
  Lock,
} from 'lucide-react';
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

interface ComplianceCheck {
  id: string;
  surrogateId: string;
  frameworkId: string;
  status: string;
  results: CheckResult[];
  passed: number;
  failed: number;
  score: number | null;
  report: unknown;
  checkedBy: string | null;
  createdAt: string;
}

interface CheckResult {
  requirementId: string;
  title: string;
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'NOT_APPLICABLE';
  evidence: string;
  severity: string;
}

interface CertificationStatus {
  id: string;
  surrogateId: string;
  frameworkId: string;
  status: string;
  passed: number;
  failed: number;
  score: number | null;
  createdAt: string;
}

interface SOPVerification {
  sopId: string;
  fingerprint: string;
  signed: boolean;
  allVerified?: boolean;
  fingerprintMatch?: boolean;
  signatureCount?: number;
  chain?: ChainEntry[];
}

interface ChainEntry {
  signatureId: string;
  signerId: string;
  fingerprint: string;
  signedAt: string;
  verified: boolean;
}

interface ComplianceFramework {
  id: string;
  name: string;
  jurisdiction: string;
  domain: string;
  version: string;
}

interface SOP {
  id: string;
  title: string;
  version: number;
  status: string;
  surrogateId: string;
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

function statusIcon(status: string) {
  switch (status) {
    case 'PASSED':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'WARNING':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default:
      return <div className="h-4 w-4 rounded-full bg-[var(--color-text-muted)]" />;
  }
}

function severityVariant(severity: string): 'danger' | 'warning' | 'info' {
  switch (severity) {
    case 'CRITICAL':
      return 'danger';
    case 'HIGH':
      return 'warning';
    default:
      return 'info';
  }
}

export default function SurrogateComplianceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const surrogateId = params.surrogateId as string;

  const [certStatus, setCertStatus] = useState<CertificationStatus[]>([]);
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [selectedCheck, setSelectedCheck] = useState<ComplianceCheck | null>(null);
  const [sopVerifications, setSopVerifications] = useState<Record<string, SOPVerification>>({});
  const [history, setHistory] = useState<ComplianceCheck[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, fwRes, sopRes] = await Promise.all([
        apiClient.get<CertificationStatus[]>(`/compliance/status/${surrogateId}`),
        apiClient.get<ComplianceFramework[]>('/compliance/frameworks'),
        apiClient.get<PaginatedResponse<SOP>>(`/sops?surrogateId=${surrogateId}&pageSize=100`),
      ]);

      if (statusRes.success && statusRes.data) {
        setCertStatus(statusRes.data);
      }
      if (fwRes.success && fwRes.data) {
        setFrameworks(fwRes.data);
      }
      if (sopRes.success && sopRes.data) {
        setSOPs(sopRes.data.data);
        // Verify each SOP
        for (const sop of sopRes.data.data) {
          const verifyRes = await apiClient.get<SOPVerification>(
            `/compliance/verify/${sop.id}`,
          );
          if (verifyRes.success && verifyRes.data) {
            setSopVerifications((prev) => ({ ...prev, [sop.id]: verifyRes.data! }));
          }
        }
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, [surrogateId]);

  const fetchHistory = useCallback(async (page: number) => {
    try {
      const res = await apiClient.get<PaginatedResponse<ComplianceCheck>>(
        `/compliance/history/${surrogateId}?page=${page}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setHistory(res.data.data);
        setHistoryTotalPages(res.data.totalPages ?? 1);
      }
    } catch {
      // ignore
    }
  }, [surrogateId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchHistory(historyPage);
  }, [historyPage, fetchHistory]);

  const frameworkName = (id: string) => frameworks.find((f) => f.id === id)?.name ?? id;

  async function handleSignSOP(sopId: string) {
    setSigning(sopId);
    try {
      await apiClient.post(`/compliance/sign/${sopId}`);
      // Re-verify
      const verifyRes = await apiClient.get<SOPVerification>(`/compliance/verify/${sopId}`);
      if (verifyRes.success && verifyRes.data) {
        setSopVerifications((prev) => ({ ...prev, [sopId]: verifyRes.data! }));
      }
    } catch {
      // Error handled by API client
    } finally {
      setSigning(null);
    }
  }

  async function handleGenerateReport(frameworkId: string) {
    setGeneratingReport(frameworkId);
    try {
      const res = await apiClient.post<ComplianceCheck>(
        `/compliance/report/${surrogateId}`,
        { frameworkId },
      );
      if (res.success && res.data) {
        setSelectedCheck(res.data);
      }
      await fetchHistory(historyPage);
      await fetchData();
    } catch {
      // Error handled by API client
    } finally {
      setGeneratingReport(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/compliance')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Surrogate Compliance Detail</h1>
          <p className="mt-1 text-xs font-mono text-[var(--color-text-muted)]">
            {surrogateId}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Certification Status Cards */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Certification Status</h2>
            {certStatus.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--color-text-muted)]">
                  No compliance checks run yet. Go back and run a check to see status.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {certStatus.map((cs) => (
                  <Card key={cs.frameworkId}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{frameworkName(cs.frameworkId)}</h3>
                        <StatusBadge status={cs.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${scoreBg(cs.score)}`}>
                          <span className={`text-lg font-bold ${scoreColor(cs.score)}`}>
                            {cs.score !== null ? `${cs.score}%` : '-'}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          <p className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" /> {cs.passed} passed
                          </p>
                          <p className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-red-500" /> {cs.failed} failed
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {new Date(cs.createdAt).toLocaleDateString()}
                        </span>
                        <Button
                          onClick={() => handleGenerateReport(cs.frameworkId)}
                          disabled={generatingReport === cs.frameworkId}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          {generatingReport === cs.frameworkId ? 'Generating...' : 'Report'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Requirement Breakdown (from selected check or latest) */}
          {selectedCheck && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">
                Requirement Breakdown &mdash; {frameworkName(selectedCheck.frameworkId)}
              </h2>
              <Card padding={false}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Requirement</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Evidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedCheck.results as CheckResult[]).map((r) => (
                      <TableRow key={r.requirementId}>
                        <TableCell>{statusIcon(r.status)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{r.title}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{r.requirementId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={severityVariant(r.severity)}>{r.severity}</Badge>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-xs text-xs text-[var(--color-text-secondary)]">
                            {r.evidence}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* SOP Signature Chain */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">SOP Signatures</h2>
            {sops.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--color-text-muted)]">
                  No SOPs found for this surrogate.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {sops.map((sop) => {
                  const verification = sopVerifications[sop.id];
                  return (
                    <Card key={sop.id}>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileSignature className="h-4 w-4 text-[var(--color-text-muted)]" />
                            <span className="text-sm font-semibold">{sop.title}</span>
                            <Badge variant="info">v{sop.version}</Badge>
                            <StatusBadge status={sop.status} />
                          </div>
                          {verification && (
                            <div className="ml-6 text-xs text-[var(--color-text-muted)]">
                              {verification.signed ? (
                                <span className="flex items-center gap-1">
                                  <Lock className="h-3 w-3" />
                                  {verification.signatureCount} signature(s)
                                  {verification.allVerified ? (
                                    <span className="text-green-500"> &mdash; All verified</span>
                                  ) : (
                                    <span className="text-red-500"> &mdash; Verification failed</span>
                                  )}
                                  {verification.fingerprintMatch === false && (
                                    <span className="text-yellow-500"> (fingerprint mismatch - SOP modified after signing)</span>
                                  )}
                                </span>
                              ) : (
                                <span>Not signed</span>
                              )}
                              <p className="mt-0.5 font-mono text-[10px]">
                                Fingerprint: {verification.fingerprint?.slice(0, 16)}...
                              </p>
                            </div>
                          )}
                          {/* Chain of custody */}
                          {verification?.chain && verification.chain.length > 0 && (
                            <div className="ml-6 mt-2 space-y-1 border-l-2 border-[var(--color-border)] pl-3">
                              {verification.chain.map((entry, idx) => (
                                <div key={entry.signatureId} className="flex items-center gap-2 text-xs">
                                  {entry.verified ? (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-red-500" />
                                  )}
                                  <span className="font-mono text-[var(--color-text-muted)]">
                                    Signer: {entry.signerId.slice(0, 8)}...
                                  </span>
                                  <span className="text-[var(--color-text-muted)]">
                                    {new Date(entry.signedAt).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={() => handleSignSOP(sop.id)}
                          disabled={signing === sop.id || (sop.status !== 'REVIEW' && sop.status !== 'CERTIFIED')}
                        >
                          <Lock className="mr-1 h-3 w-3" />
                          {signing === sop.id ? 'Signing...' : 'Sign SOP'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Check History */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Check History</h2>
            <Card padding={false}>
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldAlert className="mb-3 h-6 w-6 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-muted)]">No check history yet</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Framework</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Passed / Failed</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((check) => (
                        <TableRow
                          key={check.id}
                          onClick={() => setSelectedCheck(check)}
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
                            <span className="text-sm">
                              <span className="text-green-500">{check.passed}</span>
                              {' / '}
                              <span className="text-red-500">{check.failed}</span>
                            </span>
                          </TableCell>
                          <TableCell>
                            {new Date(check.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="px-4 pb-4">
                    <Pagination
                      page={historyPage}
                      totalPages={historyTotalPages}
                      onPageChange={setHistoryPage}
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
