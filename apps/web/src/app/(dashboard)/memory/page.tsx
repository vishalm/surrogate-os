'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brain } from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { MemoryEntry, PaginatedResponse, Surrogate } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

type TabFilter = 'ALL' | 'STM' | 'LTM';

interface CreateFormState {
  surrogateId: string;
  type: 'STM' | 'LTM';
  content: string;
  tags: string;
}

const INITIAL_FORM: CreateFormState = {
  surrogateId: '',
  type: 'STM',
  content: '',
  tags: '',
};

export default function MemoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [surrogates, setSurrogates] = useState<Surrogate[]>([]);

  const fetchEntries = useCallback(
    async (currentPage: number, typeFilter: TabFilter) => {
      setLoading(true);
      try {
        let url = `/memory?page=${currentPage}&pageSize=${PAGE_SIZE}`;
        if (typeFilter !== 'ALL') {
          url += `&type=${typeFilter}`;
        }
        const res = await apiClient.get<PaginatedResponse<MemoryEntry>>(url);
        if (res.success && res.data) {
          setEntries(res.data.data);
          setTotalPages(res.data.totalPages ?? 1);
        }
      } catch {
        // API may not be running
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchSurrogates = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchEntries(page, activeTab);
  }, [page, activeTab, fetchEntries]);

  useEffect(() => {
    fetchSurrogates();
  }, [fetchSurrogates]);

  function handleTabChange(tab: TabFilter) {
    setActiveTab(tab);
    setPage(1);
  }

  async function handleCreate() {
    if (!form.surrogateId || !form.content) return;
    setSubmitting(true);
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await apiClient.post('/memory', {
        surrogateId: form.surrogateId,
        type: form.type,
        source: 'MANUAL',
        content: form.content,
        tags,
      });
      setForm(INITIAL_FORM);
      setShowCreateForm(false);
      fetchEntries(page, activeTab);
    } catch {
      // handle error
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePromote(id: string) {
    try {
      await apiClient.patch(`/memory/${id}/promote`);
      fetchEntries(page, activeTab);
    } catch {
      // handle error
    }
  }

  async function handleArchive(id: string) {
    try {
      await apiClient.delete(`/memory/${id}`);
      fetchEntries(page, activeTab);
    } catch {
      // handle error
    }
  }

  async function handleDetectPatterns() {
    if (!form.surrogateId && surrogates.length === 0) return;
    const targetId = form.surrogateId || surrogates[0]?.id;
    if (!targetId) return;
    try {
      await apiClient.post('/memory/detect-patterns', {
        surrogateId: targetId,
      });
      fetchEntries(page, activeTab);
    } catch {
      // handle error
    }
  }

  function truncate(text: string, maxLen: number) {
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  }

  const tabs: { label: string; value: TabFilter }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Short-Term', value: 'STM' },
    { label: 'Long-Term', value: 'LTM' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Institutional Memory</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage surrogate memories and pattern detection
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDetectPatterns}
          >
            Detect Patterns
          </Button>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            Create Memory
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-medium">New Memory Entry</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                  Surrogate
                </label>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm"
                  value={form.surrogateId}
                  onChange={(e) =>
                    setForm({ ...form, surrogateId: e.target.value })
                  }
                >
                  <option value="">Select surrogate...</option>
                  {surrogates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.roleTitle}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                  Type
                </label>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as 'STM' | 'LTM',
                    })
                  }
                >
                  <option value="STM">Short-Term (STM)</option>
                  <option value="LTM">Long-Term (LTM)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                Content
              </label>
              <textarea
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm"
                rows={3}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Memory content..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                Tags (comma-separated)
              </label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  setForm(INITIAL_FORM);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--color-bg-elevated)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <Brain className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No memory entries found
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Create a memory entry or run pattern detection
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Observations</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Last Observed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    onClick={() => router.push(`/memory/${entry.id}`)}
                  >
                    <TableCell className="max-w-xs font-medium text-[var(--color-text-primary)]">
                      {truncate(entry.content, 80)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.type === 'STM' ? 'warning' : 'info'}
                      >
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{entry.source}</Badge>
                    </TableCell>
                    <TableCell>{entry.observationCount}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="default">
                            {tag}
                          </Badge>
                        ))}
                        {entry.tags.length > 3 && (
                          <Badge variant="muted">
                            +{entry.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(entry.lastObservedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entry.type === 'STM' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handlePromote(entry.id)}
                          >
                            Promote
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleArchive(entry.id)}
                        >
                          Archive
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 pb-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
