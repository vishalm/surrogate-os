'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Button, Card, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import GraphDiffView from '@/components/graph-diff';
import type { SOPProposal, SOPGraph } from '@surrogate-os/shared';

const statusVariant: Record<string, 'warning' | 'success' | 'danger' | 'muted'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUPERSEDED: 'muted',
};

export default function ProposalDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [proposal, setProposal] = useState<SOPProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchProposal() {
      try {
        const res = await apiClient.get<SOPProposal>(`/proposals/${id}`);
        if (res.success && res.data) {
          setProposal(res.data);
        }
      } catch {
        // API may not be running
      } finally {
        setLoading(false);
      }
    }
    fetchProposal();
  }, [id]);

  const handleReview = useCallback(
    async (status: 'APPROVED' | 'REJECTED') => {
      setActionLoading(true);
      setMessage(null);
      try {
        const res = await apiClient.patch<SOPProposal>(`/proposals/${id}/review`, {
          status,
        });
        if (res.success && res.data) {
          setProposal(res.data);
          setMessage({
            type: 'success',
            text: `Proposal ${status.toLowerCase()}`,
          });
        } else {
          setMessage({
            type: 'error',
            text: res.error?.message ?? `Failed to ${status.toLowerCase()} proposal`,
          });
        }
      } catch {
        setMessage({ type: 'error', text: 'An error occurred' });
      } finally {
        setActionLoading(false);
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

  if (!proposal) {
    return (
      <div className="py-24 text-center">
        <p className="text-[var(--color-text-secondary)]">Proposal not found</p>
        <Link href="/proposals" className="mt-4 inline-block">
          <Button variant="secondary" size="sm">
            Back to Proposals
          </Button>
        </Link>
      </div>
    );
  }

  const diff = proposal.diff as {
    addedNodes?: { id: string; label: string }[];
    removedNodes?: { id: string; label: string }[];
    modifiedNodes?: { before: { id: string; label: string }; after: { id: string; label: string } }[];
    addedEdges?: { id: string }[];
    removedEdges?: { id: string }[];
    modifiedEdges?: { before: { id: string }; after: { id: string } }[];
    summary?: string;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/proposals"
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Proposal Detail</h1>
              <Badge variant={statusVariant[proposal.status] ?? 'muted'}>
                {proposal.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              SOP: {proposal.sopId.slice(0, 8)}... | Created: {new Date(proposal.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {proposal.status === 'PENDING' && (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={() => handleReview('APPROVED')}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={actionLoading}
              onClick={() => handleReview('REJECTED')}
            >
              Reject
            </Button>
          </div>
        )}
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

      {/* Rationale */}
      <Card header="Rationale">
        <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
          {proposal.rationale}
        </p>
      </Card>

      {/* Diff summary */}
      <Card header="Changes Summary">
        <p className="mb-4 text-sm font-medium text-[var(--color-text-primary)]">
          {diff.summary ?? 'No summary available'}
        </p>

        <GraphDiffView
          currentGraph={proposal.currentGraph}
          proposedGraph={proposal.proposedGraph}
          diff={proposal.diff}
        />
      </Card>

      {/* Graph stats comparison */}
      <Card header="Graph Comparison">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">Current Graph</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-secondary)]">Nodes</dt>
                <dd className="text-sm font-mono font-medium">{proposal.currentGraph.nodes.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-secondary)]">Edges</dt>
                <dd className="text-sm font-mono font-medium">{proposal.currentGraph.edges.length}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">Proposed Graph</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-secondary)]">Nodes</dt>
                <dd className="text-sm font-mono font-medium">{proposal.proposedGraph.nodes.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-secondary)]">Edges</dt>
                <dd className="text-sm font-mono font-medium">{proposal.proposedGraph.edges.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>

      {/* Metadata */}
      <Card header="Metadata">
        <dl className="space-y-3">
          {[
            ['Proposal ID', proposal.id.slice(0, 16) + '...'],
            ['SOP ID', proposal.sopId.slice(0, 16) + '...'],
            ['Surrogate ID', proposal.surrogateId.slice(0, 16) + '...'],
            ['Proposed By', proposal.proposedBy.slice(0, 16) + '...'],
            ['Reviewed By', proposal.reviewedBy ? proposal.reviewedBy.slice(0, 16) + '...' : '-'],
            ['Reviewed At', proposal.reviewedAt ? new Date(proposal.reviewedAt).toLocaleString() : '-'],
            ['Created', new Date(proposal.createdAt).toLocaleString()],
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
