'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
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
import type { OrgDocument, PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 20;

export default function OrgDNAPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<OrgDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<OrgDocument>>(
        `/org-dna/documents?page=${currentPage}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setDocuments(res.data.data);
        setTotalPages(res.data.totalPages ?? 1);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments(page);
  }, [page, fetchDocuments]);

  async function handleUpload() {
    if (!title.trim() || !content.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await apiClient.post<OrgDocument>('/org-dna/documents', {
        title: title.trim(),
        content: content.trim(),
        mimeType: 'text/plain',
      });
      if (res.success) {
        setTitle('');
        setContent('');
        setShowUpload(false);
        fetchDocuments(page);
      } else {
        setUploadError(res.error?.message ?? 'Upload failed');
      }
    } catch {
      setUploadError('An error occurred during upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Org DNA</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Upload and manage organizational knowledge documents
          </p>
        </div>
        <Button onClick={() => setShowUpload(!showUpload)}>
          {showUpload ? 'Cancel' : 'Upload Document'}
        </Button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <Card header="Upload Document">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="doc-title"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
              >
                Title
              </label>
              <input
                id="doc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label
                htmlFor="doc-content"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
              >
                Content
              </label>
              <textarea
                id="doc-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your document content here..."
                rows={8}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            {uploadError && (
              <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {uploadError}
              </div>
            )}
            <Button
              loading={uploading}
              onClick={handleUpload}
              disabled={!title.trim() || !content.trim()}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </Card>
      )}

      {/* Document List */}
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <FileText className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No documents yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Upload your first organizational knowledge document
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setShowUpload(true)}
            >
              Upload Document
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow
                    key={doc.id}
                    onClick={() => router.push(`/org-dna/${doc.id}`)}
                  >
                    <TableCell className="font-medium text-[var(--color-text-primary)]">
                      {doc.title}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell>{doc.chunkCount}</TableCell>
                    <TableCell>
                      {new Date(doc.createdAt).toLocaleDateString()}
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
