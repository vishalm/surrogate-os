'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot } from 'lucide-react';
import {
  Button,
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
import type { Surrogate, PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

export default function SurrogatesPage() {
  const router = useRouter();
  const [surrogates, setSurrogates] = useState<Surrogate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSurrogates = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<Surrogate>>(
        `/surrogates?page=${currentPage}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setSurrogates(res.data.data);
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
    fetchSurrogates(page);
  }, [page, fetchSurrogates]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Surrogates</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage your AI identity surrogates
          </p>
        </div>
        <Link href="/surrogates/new">
          <Button>Create Surrogate</Button>
        </Link>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : surrogates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <Bot className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No surrogates yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Create your first AI surrogate to get started
            </p>
            <Link href="/surrogates/new" className="mt-4">
              <Button size="sm">Create Surrogate</Button>
            </Link>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Title</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surrogates.map((s) => (
                  <TableRow
                    key={s.id}
                    onClick={() => router.push(`/surrogates/${s.id}`)}
                  >
                    <TableCell className="font-medium text-[var(--color-text-primary)]">
                      {s.roleTitle}
                    </TableCell>
                    <TableCell className="capitalize">{s.domain}</TableCell>
                    <TableCell>{s.jurisdiction}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell>
                      {new Date(s.createdAt).toLocaleDateString()}
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
