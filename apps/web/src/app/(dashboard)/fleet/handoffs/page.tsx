'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight } from 'lucide-react';
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
import type { PaginatedResponse, Handoff } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'muted'> = {
  INITIATED: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'muted',
};

const TYPE_VARIANT: Record<string, 'info' | 'primary' | 'warning'> = {
  DIGITAL_TO_DIGITAL: 'info',
  DIGITAL_TO_HUMAN: 'primary',
  HUMAN_TO_DIGITAL: 'warning',
};

const TYPE_LABEL: Record<string, string> = {
  DIGITAL_TO_DIGITAL: 'D2D',
  DIGITAL_TO_HUMAN: 'D2H',
  HUMAN_TO_DIGITAL: 'H2D',
};

export default function HandoffsListPage() {
  const router = useRouter();
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHandoffs = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<Handoff>>(
        `/handoffs?page=${currentPage}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setHandoffs(res.data.data);
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
    fetchHandoffs(page);
  }, [page, fetchHandoffs]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Handoff Protocol</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Surrogate-to-surrogate and surrogate-to-human context handoffs
        </p>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : handoffs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <ArrowLeftRight className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No handoffs initiated yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Handoffs are created when context needs to transfer between surrogates or to human operators
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Initiated</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {handoffs.map((handoff) => (
                  <TableRow
                    key={handoff.id}
                    onClick={() => router.push(`/fleet/handoffs/${handoff.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {handoff.sourceSurrogateId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {handoff.targetSurrogateId
                        ? `${handoff.targetSurrogateId.slice(0, 8)}...`
                        : handoff.targetHumanId
                          ? `${handoff.targetHumanId.slice(0, 8)}...`
                          : <span className="text-[var(--color-text-muted)]">-</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANT[handoff.type] ?? 'muted'}>
                        {TYPE_LABEL[handoff.type] ?? handoff.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[handoff.status] ?? 'muted'}>
                        {handoff.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(handoff.initiatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-[var(--color-text-secondary)]">
                      {handoff.summary
                        ? handoff.summary.length > 80
                          ? handoff.summary.slice(0, 80) + '...'
                          : handoff.summary
                        : <span className="text-[var(--color-text-muted)]">-</span>}
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
