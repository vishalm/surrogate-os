'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, StatusBadge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { OrgDocument } from '@surrogate-os/shared';

export default function OrgDNADetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [document, setDocument] = useState<OrgDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchDocument() {
      try {
        const res = await apiClient.get<OrgDocument>(`/org-dna/documents/${id}`);
        if (res.success && res.data) {
          setDocument(res.data);
        }
      } catch {
        // API may not be running
      } finally {
        setLoading(false);
      }
    }

    fetchDocument();
  }, [id]);

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this document? This will also remove all associated chunks.')) return;
    setDeleting(true);
    try {
      const res = await apiClient.delete(`/org-dna/documents/${id}`);
      if (res.success) {
        router.push('/org-dna');
      }
    } catch {
      // handle error
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="py-24 text-center">
        <p className="text-[var(--color-text-secondary)]">Document not found</p>
        <Link href="/org-dna" className="mt-4 inline-block">
          <Button variant="secondary" size="sm">
            Back to Org DNA
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/org-dna"
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{document.title}</h1>
              <StatusBadge status={document.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {document.mimeType}
            </p>
          </div>
        </div>
        <Button
          variant="danger"
          size="sm"
          loading={deleting}
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card header="Document Info">
          <dl className="space-y-3">
            {[
              ['Title', document.title],
              ['MIME Type', document.mimeType],
              ['Status', document.status],
              ['Chunk Count', document.chunkCount.toString()],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-muted)]">
                  {label}
                </dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card header="Metadata">
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-[var(--color-text-muted)]">ID</dt>
              <dd className="font-mono text-xs text-[var(--color-text-secondary)]">
                {document.id}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-[var(--color-text-muted)]">
                Created
              </dt>
              <dd className="text-sm">
                {new Date(document.createdAt).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-[var(--color-text-muted)]">
                Updated
              </dt>
              <dd className="text-sm">
                {new Date(document.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
