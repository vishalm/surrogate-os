'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Upload, Archive, Zap, RotateCcw } from 'lucide-react';
import { Button, Card, StatusBadge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { PersonaTemplate, PersonaVersion } from '@surrogate-os/shared';

interface TemplateWithVersions extends PersonaTemplate {
  versions: PersonaVersion[];
}

export default function PersonaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [template, setTemplate] = useState<TemplateWithVersions | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<TemplateWithVersions>(`/personas/${id}`);
      if (res.success && res.data) {
        setTemplate(res.data);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  async function handleInstantiate() {
    setActionLoading('instantiate');
    try {
      const res = await apiClient.post(`/personas/${id}/instantiate`);
      if (res.success) {
        router.push('/surrogates');
      }
    } catch {
      // handle error silently
    } finally {
      setActionLoading('');
    }
  }

  async function handleExport() {
    setActionLoading('export');
    try {
      const res = await apiClient.get<Record<string, unknown>>(`/personas/${id}/export`);
      if (res.success && res.data) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `persona-${template?.name ?? id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // handle error silently
    } finally {
      setActionLoading('');
    }
  }

  async function handleArchive() {
    setActionLoading('archive');
    try {
      await apiClient.delete(`/personas/${id}`);
      router.push('/personas');
    } catch {
      // handle error silently
    } finally {
      setActionLoading('');
    }
  }

  async function handleRollback(version: string) {
    setActionLoading(`rollback-${version}`);
    try {
      const res = await apiClient.post(`/personas/${id}/rollback`, { version });
      if (res.success) {
        await fetchTemplate();
      }
    } catch {
      // handle error silently
    } finally {
      setActionLoading('');
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionLoading('import');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await apiClient.post('/personas/import', data);
      if (res.success) {
        router.push('/personas');
      }
    } catch {
      // handle error silently
    } finally {
      setActionLoading('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Persona template not found.
        </p>
        <Button variant="secondary" onClick={() => router.push('/personas')}>
          Back to Personas
        </Button>
      </div>
    );
  }

  const configEntries = Object.entries(template.baseConfig ?? {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/personas')}
            className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{template.name}</h1>
              <span className="inline-flex items-center rounded-md bg-[var(--color-bg-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                v{template.currentVersion}
              </span>
              <StatusBadge status={template.status} />
            </div>
            {template.description && (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {template.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleInstantiate}
            loading={actionLoading === 'instantiate'}
          >
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Instantiate Surrogate
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExport}
            loading={actionLoading === 'export'}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export JSON
          </Button>
          {template.status !== 'ARCHIVED' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleArchive}
              loading={actionLoading === 'archive'}
            >
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              Archive
            </Button>
          )}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              loading={actionLoading === 'import'}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Import
            </Button>
          </div>
        </div>
      </div>

      {/* Properties Card */}
      <Card>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          Properties
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--color-text-muted)]">Domain</span>
            <p className="mt-0.5 font-medium capitalize text-[var(--color-text-primary)]">
              {template.domain}
            </p>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Jurisdiction</span>
            <p className="mt-0.5 font-medium text-[var(--color-text-primary)]">
              {template.jurisdiction}
            </p>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Category</span>
            <p className="mt-0.5 font-medium text-[var(--color-text-primary)]">
              {template.category ?? 'None'}
            </p>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Tags</span>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {(template.tags ?? []).length > 0 ? (
                template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-[var(--color-text-muted)]">No tags</span>
              )}
            </div>
          </div>
        </div>

        {configEntries.length > 0 && (
          <>
            <hr className="my-4 border-[var(--color-border)]" />
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Base Configuration
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {configEntries.map(([key, value]) => (
                <div key={key}>
                  <span className="text-[var(--color-text-muted)]">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                  </span>
                  <p className="mt-0.5 font-medium text-[var(--color-text-primary)]">
                    {String(value)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Version Timeline */}
      <Card>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          Version History
        </h2>
        {(template.versions ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No versions recorded.</p>
        ) : (
          <div className="space-y-4">
            {template.versions.map((v) => {
              const isCurrent = v.version === template.currentVersion;
              return (
                <div
                  key={v.id}
                  className="flex items-start justify-between rounded-lg border border-[var(--color-border)] p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        v{v.version}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                          Current
                        </span>
                      )}
                    </div>
                    {v.changelog && (
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {v.changelog}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {new Date(v.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRollback(v.version)}
                      loading={actionLoading === `rollback-${v.version}`}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Rollback
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
