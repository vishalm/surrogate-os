'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserCog } from 'lucide-react';
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
import type { PersonaTemplate, PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

const DOMAINS = [
  { value: '', label: 'All Domains' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'legal', label: 'Legal' },
  { value: 'finance', label: 'Finance' },
  { value: 'construction', label: 'Construction' },
  { value: 'education', label: 'Education' },
  { value: 'government', label: 'Government' },
];

const STATUS_TABS = ['All', 'DRAFT', 'PUBLISHED'] as const;

export default function PersonasPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<PersonaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [domainFilter, setDomainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchTemplates = useCallback(async (currentPage: number, domain: string, status: string) => {
    setLoading(true);
    try {
      let url = `/personas?page=${currentPage}&pageSize=${PAGE_SIZE}`;
      if (domain) url += `&domain=${domain}`;
      if (status) url += `&status=${status}`;

      const res = await apiClient.get<PaginatedResponse<PersonaTemplate>>(url);
      if (res.success && res.data) {
        setTemplates(res.data.data);
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
    fetchTemplates(page, domainFilter, statusFilter);
  }, [page, domainFilter, statusFilter, fetchTemplates]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleDomainChange(value: string) {
    setDomainFilter(value);
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Persona Library</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage reusable persona templates for surrogates
          </p>
        </div>
        <Link href="/personas/new">
          <Button>Create Template</Button>
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-4">
        <select
          value={domainFilter}
          onChange={(e) => handleDomainChange(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        >
          {DOMAINS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          {STATUS_TABS.map((tab) => {
            const tabValue = tab === 'All' ? '' : tab;
            const isActive = statusFilter === tabValue;
            return (
              <button
                key={tab}
                onClick={() => handleStatusChange(tabValue)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {tab === 'All' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <UserCog className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No persona templates yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Create your first persona template to get started
            </p>
            <Link href="/personas/new" className="mt-4">
              <Button size="sm">Create Template</Button>
            </Link>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow
                    key={t.id}
                    onClick={() => router.push(`/personas/${t.id}`)}
                  >
                    <TableCell className="font-medium text-[var(--color-text-primary)]">
                      {t.name}
                    </TableCell>
                    <TableCell className="capitalize">{t.domain}</TableCell>
                    <TableCell>{t.jurisdiction}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-[var(--color-bg-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                        v{t.currentVersion}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(t.tags ?? []).slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]"
                          >
                            {tag}
                          </span>
                        ))}
                        {(t.tags ?? []).length > 3 && (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            +{t.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell>
                      {new Date(t.createdAt).toLocaleDateString()}
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
