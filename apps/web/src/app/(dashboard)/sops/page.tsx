'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import {
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  StatusBadge,
  Pagination,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { SOP, PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

export default function SOPsPage() {
  const router = useRouter();
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSOPs = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<SOP>>(
        `/sops?page=${currentPage}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setSOPs(res.data.data);
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
    fetchSOPs(page);
  }, [page, fetchSOPs]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Standard Operating Procedures</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Versioned decision graphs that govern surrogate behavior
        </p>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : sops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <FileText className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No SOPs created yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              SOPs are created when you define decision workflows for surrogates
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Surrogate</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Certified By</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sops.map((sop) => (
                  <TableRow key={sop.id} onClick={() => router.push(`/sops/${sop.id}`)}>
                    <TableCell className="font-medium text-[var(--color-text-primary)]">
                      {sop.title}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {sop.surrogateId.slice(0, 8)}...
                    </TableCell>
                    <TableCell>v{sop.version}</TableCell>
                    <TableCell>
                      <StatusBadge status={sop.status} />
                    </TableCell>
                    <TableCell>
                      {sop.certifiedBy ? (
                        <span className="font-mono text-xs">
                          {sop.certifiedBy.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(sop.createdAt).toLocaleDateString()}
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
