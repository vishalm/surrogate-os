'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import { Button, Card, Badge, StatusBadge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import SOPGraphView from '@/components/sop-graph';
import type { SOP } from '@surrogate-os/shared';

type StatusAction = {
  label: string;
  targetStatus: string;
  variant: 'primary' | 'secondary' | 'danger';
};

function getStatusActions(currentStatus: string): StatusAction[] {
  switch (currentStatus) {
    case 'DRAFT':
      return [{ label: 'Submit for Review', targetStatus: 'REVIEW', variant: 'primary' }];
    case 'REVIEW':
      return [
        { label: 'Certify', targetStatus: 'CERTIFIED', variant: 'primary' },
        { label: 'Reject', targetStatus: 'DRAFT', variant: 'danger' },
      ];
    case 'CERTIFIED':
      return [{ label: 'Deprecate', targetStatus: 'DEPRECATED', variant: 'danger' }];
    case 'DEPRECATED':
      return [];
    default:
      return [];
  }
}

export default function SOPDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [sop, setSOP] = useState<SOP | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchSOP() {
      try {
        const res = await apiClient.get<SOP>(`/sops/${id}`);
        if (res.success && res.data) {
          setSOP(res.data);
        }
      } catch {
        // API may not be running
      } finally {
        setLoading(false);
      }
    }
    fetchSOP();
  }, [id]);

  const handleStatusChange = useCallback(
    async (targetStatus: string) => {
      setStatusLoading(true);
      setMessage(null);
      try {
        const res = await apiClient.patch<SOP>(`/sops/${id}/status`, {
          status: targetStatus,
        });
        if (res.success && res.data) {
          setSOP(res.data);
          setMessage({ type: 'success', text: `Status updated to ${targetStatus}` });
        } else {
          setMessage({
            type: 'error',
            text: res.error?.message ?? 'Failed to update status',
          });
        }
      } catch {
        setMessage({ type: 'error', text: 'An error occurred while updating status' });
      } finally {
        setStatusLoading(false);
      }
    },
    [id],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!sop) {
    return (
      <div className="py-24 text-center">
        <p className="text-[var(--color-text-secondary)]">SOP not found</p>
        <Link href="/sops" className="mt-4 inline-block">
          <Button variant="secondary" size="sm">
            Back to SOPs
          </Button>
        </Link>
      </div>
    );
  }

  const statusActions = getStatusActions(sop.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/sops"
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{sop.title}</h1>
              <Badge variant="default">v{sop.version}</Badge>
              <StatusBadge status={sop.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              SOP &middot; {sop.graph.nodes.length} nodes &middot;{' '}
              {sop.graph.edges.length} edges
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusActions.length > 0 ? (
            statusActions.map((action) => (
              <Button
                key={action.targetStatus}
                variant={action.variant}
                size="sm"
                loading={statusLoading}
                onClick={() => handleStatusChange(action.targetStatus)}
              >
                {action.label}
              </Button>
            ))
          ) : (
            <span className="rounded-md bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)]">
              Read-only (Deprecated)
            </span>
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

      {/* Description */}
      {sop.description && (
        <Card header="Description">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {sop.description}
          </p>
        </Card>
      )}

      {/* Graph */}
      <Card header="SOP Graph">
        <SOPGraphView graph={sop.graph} />
      </Card>

      {/* Metadata */}
      <Card header="Metadata">
        <dl className="space-y-3">
          {[
            ['Hash', sop.hash ? `${sop.hash.slice(0, 16)}...` : '-'],
            ['Certified By', sop.certifiedBy ? `${sop.certifiedBy.slice(0, 8)}...` : '-'],
            ['Surrogate ID', sop.surrogateId ? `${sop.surrogateId.slice(0, 8)}...` : '-'],
            ['Created', new Date(sop.createdAt).toLocaleString()],
            ['Updated', new Date(sop.updatedAt).toLocaleString()],
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
    </div>
  );
}
