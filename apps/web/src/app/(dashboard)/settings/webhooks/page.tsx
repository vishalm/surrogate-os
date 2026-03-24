'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Send,
  Globe,
  Copy,
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryItem {
  id: string;
  webhookId: string;
  event: string;
  statusCode: number | null;
  response: string | null;
  attempts: number;
  deliveredAt: string | null;
  createdAt: string;
}

interface DeliveriesResponse {
  data: DeliveryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const WEBHOOK_EVENTS = [
  { id: 'surrogate.created', label: 'Surrogate Created' },
  { id: 'sop.certified', label: 'SOP Certified' },
  { id: 'session.completed', label: 'Session Completed' },
  { id: 'debrief.generated', label: 'Debrief Generated' },
  { id: 'proposal.approved', label: 'Proposal Approved' },
  { id: 'compliance.check_completed', label: 'Compliance Check' },
  { id: 'execution.completed', label: 'Execution Completed' },
  { id: 'bias.check_completed', label: 'Bias Check Completed' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, DeliveryItem[]>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  async function fetchWebhooks() {
    try {
      const res = await apiClient.get<WebhookItem[]>('/webhooks');
      if (res.success && res.data) setWebhooks(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newUrl.trim() || selectedEvents.length === 0) return;
    setCreating(true);
    setMsg(null);

    try {
      const res = await apiClient.post<WebhookItem>('/webhooks', {
        url: newUrl.trim(),
        events: selectedEvents,
      });

      if (res.success && res.data) {
        setCreatedSecret(res.data.secret ?? null);
        setNewUrl('');
        setSelectedEvents([]);
        setShowCreate(false);
        fetchWebhooks();
      } else {
        setMsg({ type: 'error', text: res.error?.message ?? 'Failed to create webhook' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(webhookId: string, currentActive: boolean) {
    try {
      await apiClient.patch(`/webhooks/${webhookId}`, { active: !currentActive });
      fetchWebhooks();
    } catch { /* ignore */ }
  }

  async function handleDelete(webhookId: string) {
    setDeletingId(webhookId);
    try {
      const res = await apiClient.delete(`/webhooks/${webhookId}`);
      if (res.success) {
        fetchWebhooks();
        setMsg({ type: 'success', text: 'Webhook deleted' });
      } else {
        setMsg({ type: 'error', text: res.error?.message ?? 'Failed to delete' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTest(webhookId: string) {
    setTestingId(webhookId);
    try {
      const res = await apiClient.post<DeliveryItem>(`/webhooks/${webhookId}/test`);
      if (res.success) {
        setMsg({ type: 'success', text: 'Test webhook sent' });
        // Refresh deliveries if expanded
        if (expandedId === webhookId) {
          fetchDeliveries(webhookId);
        }
      } else {
        setMsg({ type: 'error', text: res.error?.message ?? 'Failed to send test' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setTestingId(null);
    }
  }

  async function fetchDeliveries(webhookId: string) {
    try {
      const res = await apiClient.get<DeliveriesResponse>(
        `/webhooks/${webhookId}/deliveries?pageSize=10`,
      );
      if (res.success && res.data) {
        setDeliveries((prev) => ({ ...prev, [webhookId]: res.data!.data }));
      }
    } catch { /* ignore */ }
  }

  function toggleExpand(webhookId: string) {
    if (expandedId === webhookId) {
      setExpandedId(null);
    } else {
      setExpandedId(webhookId);
      if (!deliveries[webhookId]) {
        fetchDeliveries(webhookId);
      }
    }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event],
    );
  }

  function handleCopySecret() {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Receive real-time notifications when events happen in Surrogate OS
          </p>
        </div>
        <Button onClick={() => { setShowCreate(!showCreate); setCreatedSecret(null); }}>
          <Plus className="h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      {/* Created secret dialog */}
      {createdSecret && (
        <Card header={
          <div className="flex items-center gap-2 text-[var(--color-warning)]">
            <AlertCircle className="h-4 w-4" />
            <span>Save your webhook signing secret</span>
          </div>
        }>
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Use this secret to verify webhook payloads (HMAC-SHA256). Store it securely.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] break-all">
                {createdSecret}
              </code>
              <Button variant="secondary" size="sm" onClick={handleCopySecret}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCreatedSecret(null)}>
              <X className="h-4 w-4" />
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Message */}
      {msg && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          msg.type === 'success'
            ? 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]'
            : 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
        }`}>
          {msg.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card header={
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--color-primary)]" />
            <span>Register New Webhook</span>
          </div>
        }>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                Endpoint URL <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                Events <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <label
                    key={event.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selectedEvents.includes(event.id)
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event.id)}
                      onChange={() => toggleEvent(event.id)}
                      className="accent-[var(--color-primary)]"
                    />
                    <span className="text-[var(--color-text-primary)]">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={creating} disabled={selectedEvents.length === 0}>
                <Webhook className="h-4 w-4" />
                Register Webhook
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Webhooks list */}
      <Card header={
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span>Registered Webhooks ({webhooks.length})</span>
        </div>
      }>
        {webhooks.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            No webhooks registered. Add one to receive event notifications.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {webhooks.map((wh) => (
              <div key={wh.id}>
                <div className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-medium text-[var(--color-text-primary)]">
                        {wh.url}
                      </code>
                      <Badge variant={wh.active ? 'success' : 'muted'}>
                        {wh.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {wh.events.map((e) => (
                        <Badge key={e} variant="default">{e}</Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Created {new Date(wh.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Toggle active */}
                    <button
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        wh.active
                          ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-warning)]'
                          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[#22c55e]'
                      }`}
                      title={wh.active ? 'Disable' : 'Enable'}
                      onClick={() => handleToggleActive(wh.id, wh.active)}
                    >
                      {wh.active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-primary)] disabled:opacity-50"
                      title="Send test"
                      disabled={testingId === wh.id}
                      onClick={() => handleTest(wh.id)}
                    >
                      <Send className={`h-3.5 w-3.5 ${testingId === wh.id ? 'animate-pulse' : ''}`} />
                    </button>
                    <button
                      className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
                      title="View deliveries"
                      onClick={() => toggleExpand(wh.id)}
                    >
                      {expandedId === wh.id ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)] disabled:opacity-50"
                      title="Delete webhook"
                      disabled={deletingId === wh.id}
                      onClick={() => handleDelete(wh.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Delivery log */}
                {expandedId === wh.id && (
                  <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                    <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
                      Recent Deliveries
                    </p>
                    {!deliveries[wh.id] ? (
                      <p className="py-2 text-center text-xs text-[var(--color-text-muted)]">Loading...</p>
                    ) : deliveries[wh.id].length === 0 ? (
                      <p className="py-2 text-center text-xs text-[var(--color-text-muted)]">No deliveries yet</p>
                    ) : (
                      <div className="space-y-1">
                        {deliveries[wh.id].map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between rounded px-2 py-1.5 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant={d.deliveredAt ? 'success' : 'danger'}>
                                {d.statusCode ?? 'ERR'}
                              </Badge>
                              <span className="text-[var(--color-text-primary)]">{d.event}</span>
                            </div>
                            <span className="text-[var(--color-text-muted)]">
                              {new Date(d.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
