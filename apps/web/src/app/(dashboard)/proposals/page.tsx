'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GitPullRequest } from 'lucide-react';
import {
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Pagination,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { PaginatedResponse, SOPProposal } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

const statusVariant: Record<string, 'warning' | 'success' | 'danger' | 'muted'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUPERSEDED: 'muted',
};

export default function ProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<SOPProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProposals = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<SOPProposal>>(
        `/proposals?page=${currentPage}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setProposals(res.data.data);
        const total = res.data.totalPages ?? 1;
        setTotalPages(total);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals(page);
  }, [page, fetchProposals]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SOP Proposals</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Proposed SOP improvements from shift debriefs and manual submissions
        </p>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <GitPullRequest className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No proposals yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Proposals are created from shift debriefs or manual submissions
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SOP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Proposed By</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((proposal) => (
                  <TableRow
                    key={proposal.id}
                    onClick={() => router.push(`/proposals/${proposal.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {proposal.sopId.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[proposal.status] ?? 'muted'}>
                        {proposal.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {proposal.proposedBy.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {new Date(proposal.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 pb-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
