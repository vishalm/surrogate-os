'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, UserPlus, Trash2 } from 'lucide-react';
import { Button, Input, Card, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Org, User } from '@surrogate-os/shared';

export default function SettingsPage() {
  const { user } = useAuth();
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeMsg, setRemoveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [orgRes, membersRes] = await Promise.all([
          apiClient.get<Org>('/orgs/me'),
          apiClient.get<User[]>('/orgs/me/members'),
        ]);

        if (orgRes.success && orgRes.data) {
          setOrg(orgRes.data);
          setOrgName(orgRes.data.name);
        }
        if (membersRes.success && membersRes.data) {
          setMembers(membersRes.data);
        }
      } catch {
        // API may not be running
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleSaveOrg(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await apiClient.patch<Org>('/orgs/me', { name: orgName });
      if (res.success && res.data) {
        setOrg(res.data);
        setSaveMsg({ type: 'success', text: 'Organization updated' });
      } else {
        setSaveMsg({ type: 'error', text: res.error?.message ?? 'Failed to save' });
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await apiClient.post('/auth/invite', { email: inviteEmail });
      if (res.success) {
        setInviteEmail('');
        setInviteMsg({ type: 'success', text: `Invitation sent to ${inviteEmail}` });
      } else {
        setInviteMsg({ type: 'error', text: res.error?.message ?? 'Failed to invite' });
      }
    } catch {
      setInviteMsg({ type: 'error', text: 'Unable to send invitation' });
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingId(memberId);
    setRemoveMsg(null);
    try {
      const res = await apiClient.delete(`/orgs/me/members/${memberId}`);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        setRemoveMsg({ type: 'success', text: 'Member removed' });
      } else {
        setRemoveMsg({ type: 'error', text: res.error?.message ?? 'Failed to remove member' });
      }
    } catch {
      setRemoveMsg({ type: 'error', text: 'Unable to remove member' });
    } finally {
      setRemovingId(null);
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
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Manage your organization and platform configuration
        </p>
      </div>

      {/* Organization Settings */}
      <Card header="Organization">
        <form onSubmit={handleSaveOrg} className="space-y-4">
          <Input
            label="Organization Name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Slug
            </label>
            <input
              readOnly
              value={org?.slug ?? ''}
              className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-muted)]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Plan
            </label>
            <div className="flex items-center gap-2">
              <Badge variant="primary">{org?.plan ?? 'STUDIO'}</Badge>
            </div>
          </div>
          {saveMsg && (
            <p
              className={
                saveMsg.type === 'success'
                  ? 'text-sm text-[#22c55e]'
                  : 'text-sm text-[var(--color-danger)]'
              }
            >
              {saveMsg.text}
            </p>
          )}
          <div className="pt-2">
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Members */}
      <Card header="Members">
        <div className="space-y-4">
          <form onSubmit={handleInvite} className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="colleague@company.com"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <Button type="submit" loading={inviting} size="md">
              <UserPlus className="h-4 w-4" />
              Invite
            </Button>
          </form>

          {inviteMsg && (
            <p
              className={
                inviteMsg.type === 'success'
                  ? 'text-sm text-[#22c55e]'
                  : 'text-sm text-[var(--color-danger)]'
              }
            >
              {inviteMsg.text}
            </p>
          )}

          {removeMsg && (
            <p
              className={
                removeMsg.type === 'success'
                  ? 'text-sm text-[#22c55e]'
                  : 'text-sm text-[var(--color-danger)]'
              }
            >
              {removeMsg.text}
            </p>
          )}

          <div className="divide-y divide-[var(--color-border)]">
            {members.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
                No members loaded
              </p>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {member.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        member.role === 'OWNER'
                          ? 'primary'
                          : member.role === 'ADMIN'
                            ? 'info'
                            : 'default'
                      }
                    >
                      {member.role}
                    </Badge>
                    {member.id !== user?.sub && (
                      <button
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)] disabled:opacity-50"
                        title="Remove member"
                        disabled={removingId === member.id}
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Observability */}
      <Card header="Observability">
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Monitor platform metrics, traces, and logs through the Grafana
            dashboard.
          </p>
          <a
            href="http://localhost:4000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
          >
            Open Grafana Dashboard
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </Card>
    </div>
  );
}
