'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Download,
  Upload,
  FileJson,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import {
  Button,
  Card,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 10;

interface ExportHistoryEntry {
  id: string;
  type: string;
  status: string;
  recordCount: number;
  fileSizeBytes: number | null;
  options: Record<string, unknown>;
  exportedBy: string;
  createdAt: string;
}

interface ImportResult {
  surrogatesCreated: number;
  sopsCreated: number;
  personaTemplatesCreated: number;
  memoryEntriesCreated: number;
  orgDocumentsCreated: number;
}

interface ImportPreview {
  type: string;
  surrogates: number;
  sops: number;
  personaTemplates: number;
  memoryEntries: number;
  orgDocuments: number;
  total: number;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '--';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function typeLabel(type: string): string {
  switch (type) {
    case 'ORG_EXPORT': return 'Org Export';
    case 'SURROGATE_EXPORT': return 'Surrogate Export';
    case 'SOP_EXPORT': return 'SOP Export';
    case 'ORG_IMPORT': return 'Org Import';
    case 'SOP_IMPORT': return 'SOP Import';
    default: return type;
  }
}

export default function ExportPage() {
  // Export state
  const [includeAudit, setIncludeAudit] = useState(false);
  const [includeMemory, setIncludeMemory] = useState(true);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<Record<string, unknown> | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History state
  const [history, setHistory] = useState<ExportHistoryEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<ExportHistoryEntry>>(
        `/export/history?page=${page}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setHistory(res.data.data);
        setHistoryTotal(res.data.pagination.total);
      }
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    fetchHistory(historyPage);
  }, [historyPage, fetchHistory]);

  // ---------------------------------------------------------------------------
  // Export handlers
  // ---------------------------------------------------------------------------

  function triggerDownload(data: unknown, filename: string) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleExportOrg() {
    setExporting('org');
    setExportMsg(null);
    try {
      const body: Record<string, unknown> = { includeAudit, includeMemory };
      if (dateStart && dateEnd) {
        body.dateRange = { start: dateStart, end: dateEnd };
      }
      const res = await apiClient.post<unknown>('/export/org', body);
      if (res.success && res.data) {
        const ts = new Date().toISOString().slice(0, 10);
        triggerDownload(res.data, `surrogate-os-org-export-${ts}.json`);
        setExportMsg({ type: 'success', text: 'Organization data exported successfully' });
        fetchHistory(historyPage);
      } else {
        setExportMsg({ type: 'error', text: res.error?.message ?? 'Export failed' });
      }
    } catch {
      setExportMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setExporting(null);
    }
  }

  async function handleExportSOPs() {
    setExporting('sops');
    setExportMsg(null);
    try {
      const res = await apiClient.post<unknown>('/export/sops');
      if (res.success && res.data) {
        const ts = new Date().toISOString().slice(0, 10);
        triggerDownload(res.data, `surrogate-os-sops-export-${ts}.json`);
        setExportMsg({ type: 'success', text: 'SOPs exported successfully' });
        fetchHistory(historyPage);
      } else {
        setExportMsg({ type: 'error', text: res.error?.message ?? 'Export failed' });
      }
    } catch {
      setExportMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setExporting(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Import handlers
  // ---------------------------------------------------------------------------

  function parseImportFile(file: File) {
    setImportMsg(null);
    setImportData(null);
    setImportPreview(null);
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed.type || !parsed.exportVersion) {
          setImportMsg({ type: 'error', text: 'Invalid file: missing type or exportVersion field' });
          return;
        }

        setImportData(parsed);

        // Build preview
        const preview: ImportPreview = {
          type: parsed.type,
          surrogates: parsed.surrogates?.length ?? 0,
          sops: parsed.sops?.length ?? 0,
          personaTemplates: parsed.personaTemplates?.length ?? 0,
          memoryEntries: parsed.memoryEntries?.length ?? 0,
          orgDocuments: parsed.orgDocuments?.length ?? 0,
          total: 0,
        };
        preview.total = preview.surrogates + preview.sops + preview.personaTemplates + preview.memoryEntries + preview.orgDocuments;
        setImportPreview(preview);
      } catch {
        setImportMsg({ type: 'error', text: 'Invalid JSON file' });
      }
    };
    reader.readAsText(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseImportFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseImportFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  async function handleImport() {
    if (!importData) return;
    setImporting(true);
    setImportMsg(null);

    try {
      let res;
      if (importData.type === 'ORG_EXPORT') {
        res = await apiClient.post<ImportResult>('/export/import/org', importData);
      } else if (importData.type === 'SOP_EXPORT') {
        setImportMsg({ type: 'error', text: 'SOP import requires a target surrogate. Use the surrogate detail page to import SOPs.' });
        setImporting(false);
        return;
      } else {
        setImportMsg({ type: 'error', text: `Unsupported import type: ${String(importData.type)}` });
        setImporting(false);
        return;
      }

      if (res.success && res.data) {
        const d = res.data;
        const parts: string[] = [];
        if (d.surrogatesCreated > 0) parts.push(`${d.surrogatesCreated} surrogates`);
        if (d.sopsCreated > 0) parts.push(`${d.sopsCreated} SOPs`);
        if (d.personaTemplatesCreated > 0) parts.push(`${d.personaTemplatesCreated} persona templates`);
        if (d.memoryEntriesCreated > 0) parts.push(`${d.memoryEntriesCreated} memory entries`);
        if (d.orgDocumentsCreated > 0) parts.push(`${d.orgDocumentsCreated} documents`);
        setImportMsg({
          type: 'success',
          text: `Import successful: ${parts.join(', ') || 'no records'}`,
        });
        setImportData(null);
        setImportPreview(null);
        setImportFile(null);
        fetchHistory(historyPage);
      } else {
        setImportMsg({ type: 'error', text: res.error?.message ?? 'Import failed' });
      }
    } catch {
      setImportMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setImporting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Import & Export</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Export your organization data for backup and portability, or import data from another instance
          </p>
        </div>
      </div>

      {/* Export Section */}
      <Card header={<div className="flex items-center gap-2"><Download className="h-4 w-4 text-[var(--color-primary)]" /><span>Export Data</span></div>}>
        <div className="space-y-5">
          {/* Export Org */}
          <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Export Organization</h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                Full backup of surrogates, SOPs, persona templates, org DNA, and compliance data
              </p>
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={includeMemory}
                  onChange={(e) => setIncludeMemory(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                Include memory entries
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={includeAudit}
                  onChange={(e) => setIncludeAudit(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                Include audit log
              </label>
            </div>

            {/* Date range */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                Date range filter (optional)
              </summary>
              <div className="mt-2 flex gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-muted)]">From</label>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-muted)]">To</label>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
                  />
                </div>
              </div>
            </details>

            <Button onClick={handleExportOrg} loading={exporting === 'org'}>
              <FileJson className="h-4 w-4" />
              Export Organization
            </Button>
          </div>

          {/* Export SOPs */}
          <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Export SOPs</h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                Portable SOP export matching the open SOP standard commitment
              </p>
            </div>
            <Button onClick={handleExportSOPs} loading={exporting === 'sops'} variant="secondary">
              <FileJson className="h-4 w-4" />
              Export SOPs
            </Button>
          </div>

          {exportMsg && (
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${exportMsg.type === 'success' ? 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]' : 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]'}`}>
              {exportMsg.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {exportMsg.text}
            </div>
          )}
        </div>
      </Card>

      {/* Import Section */}
      <Card header={<div className="flex items-center gap-2"><Upload className="h-4 w-4 text-[var(--color-primary)]" /><span>Import Data</span></div>}>
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)]'
            }`}
          >
            <Upload className="h-8 w-8 text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">
              {importFile ? importFile.name : 'Drop a JSON export file here, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Supports .json files exported from Surrogate OS
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Import preview */}
          {importPreview && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Import Preview</h4>
                <Badge variant="info">{importPreview.type === 'ORG_EXPORT' ? 'Organization' : 'SOPs'}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {importPreview.surrogates > 0 && (
                  <div className="rounded-md border border-[var(--color-border)] px-3 py-2">
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{importPreview.surrogates}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Surrogates</p>
                  </div>
                )}
                {importPreview.sops > 0 && (
                  <div className="rounded-md border border-[var(--color-border)] px-3 py-2">
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{importPreview.sops}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">SOPs</p>
                  </div>
                )}
                {importPreview.personaTemplates > 0 && (
                  <div className="rounded-md border border-[var(--color-border)] px-3 py-2">
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{importPreview.personaTemplates}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Persona Templates</p>
                  </div>
                )}
                {importPreview.memoryEntries > 0 && (
                  <div className="rounded-md border border-[var(--color-border)] px-3 py-2">
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{importPreview.memoryEntries}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Memory Entries</p>
                  </div>
                )}
                {importPreview.orgDocuments > 0 && (
                  <div className="rounded-md border border-[var(--color-border)] px-3 py-2">
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{importPreview.orgDocuments}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Documents</p>
                  </div>
                )}
                <div className="rounded-md border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-2">
                  <p className="text-lg font-bold text-[var(--color-primary)]">{importPreview.total}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Total Records</p>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button onClick={handleImport} loading={importing}>
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setImportFile(null);
                    setImportData(null);
                    setImportPreview(null);
                    setImportMsg(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {importMsg && (
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${importMsg.type === 'success' ? 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]' : 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]'}`}>
              {importMsg.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {importMsg.text}
            </div>
          )}
        </div>
      </Card>

      {/* Export History */}
      <Card header={<div className="flex items-center gap-2"><Clock className="h-4 w-4 text-[var(--color-text-muted)]" /><span>Export & Import History</span></div>}>
        {historyLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            No export or import history yet
          </p>
        ) : (
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <span className="text-sm font-medium">{typeLabel(entry.type)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'COMPLETED' ? 'success' : 'warning'}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{entry.recordCount}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {formatBytes(entry.fileSizeBytes)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {formatDate(entry.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {historyTotal > PAGE_SIZE && (
              <Pagination
                currentPage={historyPage}
                totalPages={Math.ceil(historyTotal / PAGE_SIZE)}
                onPageChange={setHistoryPage}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
