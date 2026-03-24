'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import {
  Card,
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
import type { PaginatedResponse, Session } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

export default function DebriefSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSessions = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<Session>>(
        `/debriefs/sessions?page=${currentPage}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setSessions(res.data.data);
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
    fetchSessions(page);
  }, [page, fetchSessions]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shift Debriefs</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Session recordings and AI-generated shift debrief analysis
        </p>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <ClipboardList className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No sessions recorded yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Sessions are created when a surrogate begins a shift
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Surrogate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>Debrief</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow
                    key={session.id}
                    onClick={() => router.push(`/debriefs/${session.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {session.surrogateId.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={session.status} />
                    </TableCell>
                    <TableCell>
                      {new Date(session.startedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {session.endedAt
                        ? new Date(session.endedAt).toLocaleString()
                        : <span className="text-[var(--color-text-muted)]">-</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.status === 'COMPLETED' ? 'info' : 'muted'}>
                        {session.status === 'COMPLETED' ? 'Available' : 'Pending'}
                      </Badge>
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
