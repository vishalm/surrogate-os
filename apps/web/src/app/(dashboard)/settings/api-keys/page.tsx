'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  Key,
  Copy,
  Check,
  AlertCircle,
  Trash2,
  RefreshCw,
  Plus,
  X,
  Shield,
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string;
  createdAt: string;
  rawKey?: string;
}

const AVAILABLE_SCOPES = [
  { id: 'surrogates:read', label: 'Read Surrogates' },
  { id: 'surrogates:write', label: 'Write Surrogates' },
  { id: 'sops:read', label: 'Read SOPs' },
  { id: 'sops:write', label: 'Write SOPs' },
  { id: 'audit:read', label: 'Read Audit Log' },
  { id: 'webhooks:manage', label: 'Manage Webhooks' },
  { id: 'fleet:read', label: 'Read Fleet' },
  { id: 'fleet:write', label: 'Write Fleet' },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresIn, setExpiresIn] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const res = await apiClient.get<ApiKey[]>('/api-keys');
      if (res.success && res.data) setKeys(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setMsg(null);

    try {
      let expiresAt: string | null = null;
      if (expiresIn) {
        const days = parseInt(expiresIn, 10);
        if (!isNaN(days) && days > 0) {
          const d = new Date();
          d.setDate(d.getDate() + days);
          expiresAt = d.toISOString();
        }
      }

      const res = await apiClient.post<ApiKey>('/api-keys', {
        name: newKeyName.trim(),
        scopes: selectedScopes,
        expiresAt,
      });

      if (res.success && res.data) {
        setCreatedKey(res.data.rawKey ?? null);
        setNewKeyName('');
        setSelectedScopes([]);
        setExpiresIn('');
        fetchKeys();
      } else {
        setMsg({ type: 'error', text: res.error?.message ?? 'Failed to create key' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setRevokingId(keyId);
    setMsg(null);
    try {
      const res = await apiClient.delete(`/api-keys/${keyId}`);
      if (res.success) {
        setMsg({ type: 'success', text: 'API key revoked' });
        fetchKeys();
      } else {
        setMsg({ type: 'error', text: res.error?.message ?? 'Failed to revoke' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRotate(keyId: string) {
    setRotatingId(keyId);
    setMsg(null);
    try {
      const res = await apiClient.post<ApiKey>(`/api-keys/${keyId}/rotate`);
      if (res.success && res.data) {
        setCreatedKey(res.data.rawKey ?? null);
        fetchKeys();
      } else {
        setMsg({ type: 'error', text: res.error?.message ?? 'Failed to rotate' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setRotatingId(null);
    }
  }

  function handleCopy() {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope],
    );
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

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
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage API keys for programmatic access to Surrogate OS
          </p>
        </div>
        <Button onClick={() => { setShowCreate(!showCreate); setCreatedKey(null); }}>
          <Plus className="h-4 w-4" />
          Create Key
        </Button>
      </div>

      {/* Show-once dialog for created key */}
      {createdKey && (
        <Card header={
          <div className="flex items-center gap-2 text-[var(--color-warning)]">
            <AlertCircle className="h-4 w-4" />
            <span>Save your API key now</span>
          </div>
        }>
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              This key will only be shown once. Copy and store it securely.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] break-all">
                {createdKey}
              </code>
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCreatedKey(null)}>
              <X className="h-4 w-4" />
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Create form */}
      {showCreate && !createdKey && (
        <Card header={
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-[var(--color-primary)]" />
            <span>Create New API Key</span>
          </div>
        }>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                Key Name <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production API, CI/CD Pipeline"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Scopes</label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label
                    key={scope.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selectedScopes.includes(scope.id)
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.id)}
                      onChange={() => toggleScope(scope.id)}
                      className="accent-[var(--color-primary)]"
                    />
                    <Shield className="h-3 w-3 text-[var(--color-text-muted)]" />
                    <span className="text-[var(--color-text-primary)]">{scope.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Leave empty for full access
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                Expires In (days)
              </label>
              <input
                type="number"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                placeholder="Leave empty for no expiry"
                min="1"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            {msg && (
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                msg.type === 'success'
                  ? 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]'
                  : 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
              }`}>
                {msg.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {msg.text}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={creating}>
                <Key className="h-4 w-4" />
                Create API Key
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Active Keys Table */}
      <Card header={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-[var(--color-text-muted)]" />
            <span>Active Keys ({activeKeys.length})</span>
          </div>
        </div>
      }>
        {activeKeys.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            No active API keys. Create one to get started.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {activeKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{key.name}</p>
                    {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                      <Badge variant="danger">Expired</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <code className="text-xs text-[var(--color-text-muted)]">{key.keyPrefix}</code>
                    {key.scopes.length > 0 && (
                      <div className="flex gap-1">
                        {key.scopes.slice(0, 3).map((s) => (
                          <Badge key={s} variant="muted">{s}</Badge>
                        ))}
                        {key.scopes.length > 3 && (
                          <Badge variant="muted">+{key.scopes.length - 3}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-[var(--color-text-muted)]">
                    <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                    {key.lastUsedAt && (
                      <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                    )}
                    {key.expiresAt && (
                      <span>Expires {new Date(key.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-primary)] disabled:opacity-50"
                    title="Rotate key"
                    disabled={rotatingId === key.id}
                    onClick={() => handleRotate(key.id)}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${rotatingId === key.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)] disabled:opacity-50"
                    title="Revoke key"
                    disabled={revokingId === key.id}
                    onClick={() => handleRevoke(key.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <Card header={
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <Key className="h-4 w-4" />
            <span>Revoked Keys ({revokedKeys.length})</span>
          </div>
        }>
          <div className="divide-y divide-[var(--color-border)]">
            {revokedKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between py-3 opacity-60">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] line-through">{key.name}</p>
                    <Badge variant="danger">Revoked</Badge>
                  </div>
                  <code className="mt-1 text-xs text-[var(--color-text-muted)]">{key.keyPrefix}</code>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  Revoked {new Date(key.revokedAt!).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
