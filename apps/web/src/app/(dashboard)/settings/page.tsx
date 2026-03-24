'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  ExternalLink,
  UserPlus,
  Trash2,
  Key,
  Bot,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button, Input, Card, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Org, User } from '@surrogate-os/shared';

interface LLMProvider {
  id: string;
  label: string;
  models: string[];
  requiresKey: boolean;
  fields: { key: string; label: string; placeholder: string; required: boolean }[];
}

interface OrgSettings {
  llmProvider?: string;
  llmModel?: string;
  llmApiKey?: string;
  llmApiKeySet?: boolean;
  llmEndpoint?: string;
  llmApiVersion?: string;
  llmDeploymentName?: string;
  llmMaxTokens?: number;
  [key: string]: unknown;
}

const TABS = [
  { id: 'organization', label: 'Organization' },
  { id: 'api-keys', label: 'API Keys & LLM' },
  { id: 'members', label: 'Members' },
  { id: 'observability', label: 'Observability' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('organization');
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

  // LLM state
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [settings, setSettings] = useState<OrgSettings>({});
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const [apiVersion, setApiVersion] = useState('');
  const [deploymentName, setDeploymentName] = useState('');
  const [maxTokens, setMaxTokens] = useState('4096');
  const [savingLLM, setSavingLLM] = useState(false);
  const [llmMsg, setLlmMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [orgRes, membersRes, providersRes, settingsRes] = await Promise.all([
          apiClient.get<Org>('/orgs/me'),
          apiClient.get<User[]>('/orgs/me/members'),
          apiClient.get<LLMProvider[]>('/llm/providers'),
          apiClient.get<OrgSettings>('/orgs/me/settings'),
        ]);
        if (orgRes.success && orgRes.data) { setOrg(orgRes.data); setOrgName(orgRes.data.name); }
        if (membersRes.success && membersRes.data) setMembers(membersRes.data);
        if (providersRes.success && providersRes.data) setProviders(providersRes.data);
        if (settingsRes.success && settingsRes.data) {
          const s = settingsRes.data;
          setSettings(s);
          setSelectedProvider(s.llmProvider ?? 'anthropic');
          setSelectedModel(s.llmModel ?? '');
          setEndpoint(s.llmEndpoint ?? '');
          setApiVersion(s.llmApiVersion ?? '');
          setDeploymentName(s.llmDeploymentName ?? '');
          setMaxTokens(String(s.llmMaxTokens ?? 4096));
        }
      } catch { /* API may not be running */ }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  async function handleSaveOrg(e: FormEvent) {
    e.preventDefault(); setSaving(true); setSaveMsg(null);
    try {
      const res = await apiClient.patch<Org>('/orgs/me', { name: orgName });
      if (res.success && res.data) { setOrg(res.data); setSaveMsg({ type: 'success', text: 'Organization updated' }); }
      else setSaveMsg({ type: 'error', text: res.error?.message ?? 'Failed to save' });
    } catch { setSaveMsg({ type: 'error', text: 'Unable to connect to server' }); }
    finally { setSaving(false); }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault(); if (!inviteEmail) return;
    setInviting(true); setInviteMsg(null);
    try {
      const res = await apiClient.post('/auth/invite', { email: inviteEmail, name: inviteEmail.split('@')[0] });
      if (res.success) {
        setInviteEmail('');
        setInviteMsg({ type: 'success', text: `Invitation sent to ${inviteEmail}` });
        const m = await apiClient.get<User[]>('/orgs/me/members');
        if (m.success && m.data) setMembers(m.data);
      } else setInviteMsg({ type: 'error', text: res.error?.message ?? 'Failed to invite' });
    } catch { setInviteMsg({ type: 'error', text: 'Unable to send invitation' }); }
    finally { setInviting(false); }
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingId(memberId); setRemoveMsg(null);
    try {
      const res = await apiClient.delete(`/orgs/me/members/${memberId}`);
      if (res.success) { setMembers((prev) => prev.filter((m) => m.id !== memberId)); setRemoveMsg({ type: 'success', text: 'Member removed' }); }
      else setRemoveMsg({ type: 'error', text: res.error?.message ?? 'Failed to remove member' });
    } catch { setRemoveMsg({ type: 'error', text: 'Unable to remove member' }); }
    finally { setRemovingId(null); }
  }

  async function handleSaveLLM(e: FormEvent) {
    e.preventDefault(); setSavingLLM(true); setLlmMsg(null);
    try {
      const payload: Record<string, unknown> = {
        llmProvider: selectedProvider,
        llmModel: selectedModel,
        llmEndpoint: endpoint || null,
        llmApiVersion: apiVersion || null,
        llmDeploymentName: deploymentName || null,
        llmMaxTokens: maxTokens ? Number(maxTokens) : null,
      };
      if (apiKey && !apiKey.includes('...')) payload.llmApiKey = apiKey;
      const res = await apiClient.patch<OrgSettings>('/orgs/me/settings', payload);
      if (res.success && res.data) { setSettings(res.data); setApiKey(''); setLlmMsg({ type: 'success', text: 'LLM configuration saved' }); }
      else setLlmMsg({ type: 'error', text: res.error?.message ?? 'Failed to save' });
    } catch { setLlmMsg({ type: 'error', text: 'Unable to connect to server' }); }
    finally { setSavingLLM(false); }
  }

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  function handleProviderChange(id: string) {
    setSelectedProvider(id);
    const p = providers.find((x) => x.id === id);
    if (p?.models.length) setSelectedModel(p.models[0]);
    setApiKey(''); setEndpoint(''); setApiVersion(''); setDeploymentName('');
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Manage your organization, API keys, and platform configuration</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Organization Tab */}
      {activeTab === 'organization' && (
        <Card header="Organization">
          <form onSubmit={handleSaveOrg} className="space-y-4">
            <Input label="Organization Name" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Slug</label>
              <input readOnly value={org?.slug ?? ''} className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-muted)]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Plan</label>
              <Badge variant="primary">{org?.plan ?? 'STUDIO'}</Badge>
            </div>
            {saveMsg && <p className={saveMsg.type === 'success' ? 'text-sm text-[#22c55e]' : 'text-sm text-[var(--color-danger)]'}>{saveMsg.text}</p>}
            <div className="pt-2"><Button type="submit" loading={saving}>Save Changes</Button></div>
          </form>
        </Card>
      )}

      {/* API Keys & LLM Tab */}
      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          <Card header={<div className="flex items-center gap-2"><Bot className="h-4 w-4 text-[var(--color-primary)]" /><span>LLM Provider Configuration</span></div>}>
            <form onSubmit={handleSaveLLM} className="space-y-5">
              {/* Provider Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  {providers.map((provider) => (
                    <button key={provider.id} type="button" onClick={() => handleProviderChange(provider.id)}
                      className={`rounded-lg border px-4 py-3 text-left transition-all ${selectedProvider === provider.id ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)]'}`}>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{provider.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{provider.models.length} models{provider.requiresKey ? '' : ' • No key needed'}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model */}
              {currentProvider && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]">Model</label>
                  <input
                    type="text"
                    list={`models-${currentProvider.id}`}
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    placeholder="Type or select a model name"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                  <datalist id={`models-${currentProvider.id}`}>
                    {currentProvider.models.map((m) => <option key={m} value={m} />)}
                  </datalist>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Choose from suggestions or type any model name (e.g. custom local models)
                  </p>
                </div>
              )}

              {/* Dynamic Provider Fields */}
              {currentProvider?.fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {field.label}{field.required && <span className="ml-1 text-[var(--color-danger)]">*</span>}
                  </label>
                  {field.key === 'apiKey' ? (
                    <div className="relative">
                      <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                        placeholder={settings.llmApiKeySet ? '••••• (key set — enter new to change)' : field.placeholder}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      {settings.llmApiKeySet && <div className="mt-1 flex items-center gap-1 text-xs text-[#22c55e]"><Check className="h-3 w-3" />API key is configured</div>}
                    </div>
                  ) : (
                    <input type="text"
                      value={field.key === 'endpoint' ? endpoint : field.key === 'apiVersion' ? apiVersion : field.key === 'deploymentName' ? deploymentName : ''}
                      onChange={(e) => {
                        if (field.key === 'endpoint') setEndpoint(e.target.value);
                        else if (field.key === 'apiVersion') setApiVersion(e.target.value);
                        else if (field.key === 'deploymentName') setDeploymentName(e.target.value);
                      }}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                  )}
                </div>
              ))}

              {/* Advanced */}
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Advanced Settings</summary>
                <div className="mt-3 space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                  <Input label="Max Tokens" type="number" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} placeholder="4096" />
                </div>
              </details>

              {llmMsg && (
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${llmMsg.type === 'success' ? 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]' : 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]'}`}>
                  {llmMsg.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {llmMsg.text}
                </div>
              )}
              <div className="pt-2"><Button type="submit" loading={savingLLM}><Key className="h-4 w-4" />Save LLM Configuration</Button></div>
            </form>
          </Card>

          {/* Status Card */}
          <Card header={<div className="flex items-center gap-2"><Key className="h-4 w-4 text-[var(--color-text-muted)]" /><span>Current Configuration</span></div>}>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-[var(--color-text-secondary)]">Provider</span>
                <Badge variant="primary">{settings.llmProvider ?? 'anthropic'}</Badge>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-[var(--color-text-secondary)]">Model</span>
                <span className="font-mono text-sm text-[var(--color-text-primary)]">{settings.llmModel || 'default'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-[var(--color-text-secondary)]">API Key</span>
                {settings.llmApiKeySet ? <Badge variant="success">Configured</Badge> : <Badge variant="warning">Not Set</Badge>}
              </div>
              {settings.llmEndpoint && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-[var(--color-text-secondary)]">Endpoint</span>
                  <span className="font-mono text-xs text-[var(--color-text-muted)]">{settings.llmEndpoint}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <Card header="Members">
          <div className="space-y-4">
            <form onSubmit={handleInvite} className="flex gap-3">
              <div className="flex-1"><Input placeholder="colleague@company.com" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></div>
              <Button type="submit" loading={inviting} size="md"><UserPlus className="h-4 w-4" />Invite</Button>
            </form>
            {inviteMsg && <p className={inviteMsg.type === 'success' ? 'text-sm text-[#22c55e]' : 'text-sm text-[var(--color-danger)]'}>{inviteMsg.text}</p>}
            {removeMsg && <p className={removeMsg.type === 'success' ? 'text-sm text-[#22c55e]' : 'text-sm text-[var(--color-danger)]'}>{removeMsg.text}</p>}
            <div className="divide-y divide-[var(--color-border)]">
              {members.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">No members loaded</p>
              ) : members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{member.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={member.role === 'OWNER' ? 'primary' : member.role === 'ADMIN' ? 'info' : 'default'}>{member.role}</Badge>
                    {member.id !== user?.sub && (
                      <button className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)] disabled:opacity-50"
                        title="Remove member" disabled={removingId === member.id} onClick={() => handleRemoveMember(member.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Observability Tab */}
      {activeTab === 'observability' && (
        <Card header="Observability">
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">Monitor platform metrics, traces, and logs through the Grafana dashboard.</p>
            <a href="http://localhost:4000" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
              Open Grafana Dashboard<ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
