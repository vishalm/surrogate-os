'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2, Sparkles, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import {
  Button,
  Card,
  Badge,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { Surrogate, SOP, AuditEntry, PaginatedResponse } from '@surrogate-os/shared';

export default function SurrogateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [surrogate, setSurrogate] = useState<Surrogate | null>(null);
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Generate SOP state
  const [showGenerateSOP, setShowGenerateSOP] = useState(false);
  const [generateContext, setGenerateContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    sopId: string;
    title: string;
    confidence: number;
    reasoning: string;
  } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerateSOP = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    setGenerateResult(null);
    try {
      const res = await apiClient.post<{
        sopId: string;
        title: string;
        confidence: number;
        reasoning: string;
      }>('/llm/generate-sop', {
        surrogateId: id,
        additionalContext: generateContext || undefined,
      });
      if (res.success && res.data) {
        setGenerateResult(res.data);
        // Refresh SOPs list
        const sopsRes = await apiClient.get<PaginatedResponse<SOP>>(
          `/sops?surrogateId=${id}&pageSize=20`,
        );
        if (sopsRes.success && sopsRes.data) {
          setSOPs(sopsRes.data.data);
        }
      } else {
        setGenerateError(res.error?.message ?? 'Failed to generate SOP');
      }
    } catch {
      setGenerateError('An error occurred while generating the SOP');
    } finally {
      setGenerating(false);
    }
  }, [id, generateContext]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [surrogateRes, sopsRes, auditRes] = await Promise.all([
          apiClient.get<Surrogate>(`/surrogates/${id}`),
          apiClient.get<PaginatedResponse<SOP>>(
            `/sops?surrogateId=${id}&pageSize=20`,
          ),
          apiClient.get<PaginatedResponse<AuditEntry>>(
            `/audit?surrogateId=${id}&pageSize=10`,
          ),
        ]);

        if (surrogateRes.success && surrogateRes.data) {
          setSurrogate(surrogateRes.data);
        }
        if (sopsRes.success && sopsRes.data) {
          setSOPs(sopsRes.data.data);
        }
        if (auditRes.success && auditRes.data) {
          setAuditEntries(auditRes.data.data);
        }
      } catch {
        // API may not be running
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this surrogate?')) return;
    setDeleting(true);
    try {
      const res = await apiClient.delete(`/surrogates/${id}`);
      if (res.success) {
        router.push('/surrogates');
      }
    } catch {
      // handle error
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!surrogate) {
    return (
      <div className="py-24 text-center">
        <p className="text-[var(--color-text-secondary)]">
          Surrogate not found
        </p>
        <Link href="/surrogates" className="mt-4 inline-block">
          <Button variant="secondary" size="sm">
            Back to Surrogates
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
            href="/surrogates"
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{surrogate.roleTitle}</h1>
              <StatusBadge status={surrogate.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {surrogate.domain} &middot; {surrogate.jurisdiction}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/surrogates/${id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleting}
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card header="Configuration">
          <dl className="space-y-3">
            {[
              ['Domain', surrogate.domain],
              ['Jurisdiction', surrogate.jurisdiction],
              ['Seniority', surrogate.config?.seniority ?? '-'],
              ['Risk Tolerance', surrogate.config?.riskTolerance ?? '-'],
              [
                'Assertiveness',
                surrogate.config?.assertiveness?.toString() ?? '-',
              ],
              [
                'Empathy Level',
                surrogate.config?.empathyLevel?.toString() ?? '-',
              ],
              [
                'Escalation Threshold',
                surrogate.config?.escalationThreshold?.toString() ?? '-',
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-muted)]">
                  {label}
                </dt>
                <dd className="text-sm font-medium capitalize">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card header="Metadata">
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-[var(--color-text-muted)]">ID</dt>
              <dd className="font-mono text-xs text-[var(--color-text-secondary)]">
                {surrogate.id}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-[var(--color-text-muted)]">
                Created
              </dt>
              <dd className="text-sm">
                {new Date(surrogate.createdAt).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-[var(--color-text-muted)]">
                Updated
              </dt>
              <dd className="text-sm">
                {new Date(surrogate.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* SOPs */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Associated SOPs</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">
                {sops.length} total
              </span>
              <Button
                size="sm"
                variant={showGenerateSOP ? 'secondary' : 'primary'}
                onClick={() => {
                  setShowGenerateSOP(!showGenerateSOP);
                  setGenerateResult(null);
                  setGenerateError(null);
                }}
              >
                {showGenerateSOP ? (
                  <>
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate SOP
                  </>
                )}
              </Button>
            </div>
          </div>
        }
        padding={false}
      >
        {/* Generate SOP Panel */}
        {showGenerateSOP && (
          <div className="border-b border-[var(--color-border)] p-4 space-y-3">
            <div>
              <label
                htmlFor="generate-context"
                className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5"
              >
                Additional Context (optional)
              </label>
              <textarea
                id="generate-context"
                value={generateContext}
                onChange={(e) => setGenerateContext(e.target.value)}
                placeholder="Provide any additional context for SOP generation..."
                rows={3}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                loading={generating}
                onClick={handleGenerateSOP}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generating ? 'Generating...' : 'Generate'}
              </Button>
              {generating && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  This may take 10-30 seconds...
                </span>
              )}
            </div>
            {generateError && (
              <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {generateError}
              </div>
            )}
            {generateResult && (
              <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--color-success)]">
                    SOP Generated Successfully
                  </h4>
                  <Badge variant="success">
                    {(generateResult.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                </div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {generateResult.title}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {generateResult.reasoning}
                </p>
                <Link
                  href={`/sops/${generateResult.sopId}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
                >
                  View SOP
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {sops.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            No SOPs linked to this surrogate
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sops.map((sop) => (
                <TableRow
                  key={sop.id}
                  onClick={() => router.push(`/sops/${sop.id}`)}
                >
                  <TableCell className="font-medium text-[var(--color-text-primary)]">
                    {sop.title}
                  </TableCell>
                  <TableCell>v{sop.version}</TableCell>
                  <TableCell>
                    <StatusBadge status={sop.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(sop.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Audit */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Audit Entries</h3>
            <Link
              href={`/audit?surrogateId=${id}`}
              className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            >
              View all
            </Link>
          </div>
        }
        padding={false}
      >
        {auditEntries.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            No audit entries yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <StatusBadge status={entry.action.replace(/_/g, ' ')} />
                  </TableCell>
                  <TableCell>
                    {entry.confidence != null
                      ? `${(entry.confidence * 100).toFixed(0)}%`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
