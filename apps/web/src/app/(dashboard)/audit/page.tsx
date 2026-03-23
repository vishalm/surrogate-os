'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
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
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type {
  AuditEntry,
  Surrogate,
  PaginatedResponse,
} from '@surrogate-os/shared';
import { AuditAction } from '@surrogate-os/shared';

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [surrogates, setSurrogates] = useState<Surrogate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterSurrogate, setFilterSurrogate] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (filterSurrogate) params.set('surrogateId', filterSurrogate);
      if (filterAction) params.set('action', filterAction);

      const res = await apiClient.get<PaginatedResponse<AuditEntry>>(
        `/audit?${params.toString()}`,
      );
      if (res.success && res.data) {
        setEntries(res.data.data);
        setTotalPages(res.data.totalPages);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, [page, filterSurrogate, filterAction]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    async function fetchSurrogates() {
      try {
        const res = await apiClient.get<PaginatedResponse<Surrogate>>(
          '/surrogates?pageSize=100',
        );
        if (res.success && res.data) {
          setSurrogates(res.data.data);
        }
      } catch {
        // ignore
      }
    }
    fetchSurrogates();
  }, []);

  const actionTypes = Object.values(AuditAction);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Immutable record of all platform actions with hash-chain verification
        </p>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">
              Surrogate
            </label>
            <select
              value={filterSurrogate}
              onChange={(e) => {
                setFilterSurrogate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Surrogates</option>
              {surrogates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.roleTitle}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">
              Action Type
            </label>
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Actions</option>
              {actionTypes.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterSurrogate('');
              setFilterAction('');
              setPage(1);
            }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">
            No audit entries found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Surrogate</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Hash</TableHead>
                <TableHead>Chain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                return (
                  <>
                    <TableRow
                      key={entry.id}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : entry.id)
                      }
                      className="cursor-pointer"
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(entry.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={entry.action.replace(/_/g, ' ')}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.surrogateId
                          ? entry.surrogateId.slice(0, 8) + '...'
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {entry.confidence != null
                          ? `${(entry.confidence * 100).toFixed(0)}%`
                          : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--color-text-muted)]">
                        {entry.hash.slice(0, 12)}...
                      </TableCell>
                      <TableCell>
                        {entry.previousHash ? (
                          <CheckCircle className="h-4 w-4 text-[var(--color-success)]" />
                        ) : (
                          <XCircle className="h-4 w-4 text-[var(--color-text-muted)]" />
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <tr key={`${entry.id}-detail`}>
                        <td colSpan={7} className="bg-[var(--color-bg-elevated)] px-6 py-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
                                Rationale
                              </p>
                              <p className="text-[var(--color-text-secondary)]">
                                {entry.rationale ?? 'No rationale provided'}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
                                Details
                              </p>
                              <pre className="overflow-x-auto rounded-md bg-[var(--color-bg)] p-2 font-mono text-xs text-[var(--color-text-secondary)]">
                                {JSON.stringify(entry.details, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
                                Full Hash
                              </p>
                              <p className="break-all font-mono text-xs text-[var(--color-text-muted)]">
                                {entry.hash}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
                                Previous Hash
                              </p>
                              <p className="break-all font-mono text-xs text-[var(--color-text-muted)]">
                                {entry.previousHash ?? 'Genesis entry'}
                              </p>
                            </div>
                            {entry.humanAuthRequired && (
                              <div className="col-span-2">
                                <p className="text-xs">
                                  <span className="font-medium text-[var(--color-warning)]">
                                    Human authorization required
                                  </span>
                                  {entry.humanAuthGrantedBy && (
                                    <span className="text-[var(--color-text-secondary)]">
                                      {' '}&mdash; Granted by {entry.humanAuthGrantedBy}
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
