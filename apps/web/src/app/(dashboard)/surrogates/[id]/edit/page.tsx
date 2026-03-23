'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { Surrogate } from '@surrogate-os/shared';

const DOMAINS = [
  'healthcare',
  'legal',
  'finance',
  'construction',
  'education',
  'government',
];

const RISK_LEVELS = ['low', 'medium', 'high'] as const;

const COMMUNICATION_STYLES = [
  'formal',
  'semi-formal',
  'casual',
  'technical',
] as const;

export default function EditSurrogatePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const surrogateId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [roleTitle, setRoleTitle] = useState('');
  const [domain, setDomain] = useState(DOMAINS[0]);
  const [jurisdiction, setJurisdiction] = useState('');
  const [seniority, setSeniority] = useState('');
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'medium' | 'high'>('medium');
  const [assertiveness, setAssertiveness] = useState(5);
  const [empathyLevel, setEmpathyLevel] = useState(5);
  const [communicationStyle, setCommunicationStyle] = useState<string>('formal');
  const [escalationThreshold, setEscalationThreshold] = useState(0.5);

  useEffect(() => {
    async function fetchSurrogate() {
      try {
        const res = await apiClient.get<Surrogate>(`/surrogates/${surrogateId}`);
        if (res.success && res.data) {
          const s = res.data;
          setRoleTitle(s.roleTitle);
          setDomain(s.domain);
          setJurisdiction(s.jurisdiction);

          const cfg = s.config as unknown as Record<string, unknown> | undefined;
          if (cfg) {
            if (cfg.seniority) setSeniority(cfg.seniority as string);
            if (cfg.riskTolerance) setRiskTolerance(cfg.riskTolerance as 'low' | 'medium' | 'high');
            if (cfg.assertiveness != null) setAssertiveness(cfg.assertiveness as number);
            if (cfg.empathyLevel != null) setEmpathyLevel(cfg.empathyLevel as number);
            if (cfg.communicationStyle) setCommunicationStyle(cfg.communicationStyle as string);
            if (cfg.escalationThreshold != null) setEscalationThreshold(cfg.escalationThreshold as number);
          }
        } else {
          setError('Surrogate not found');
        }
      } catch {
        setError('Unable to load surrogate');
      } finally {
        setLoading(false);
      }
    }
    fetchSurrogate();
  }, [surrogateId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        roleTitle,
        domain,
        jurisdiction,
        config: {
          ...(seniority && { seniority }),
          riskTolerance,
          assertiveness,
          empathyLevel,
          communicationStyle,
          escalationThreshold,
        },
      };

      const res = await apiClient.patch<Surrogate>(`/surrogates/${surrogateId}`, body);

      if (res.success) {
        router.push(`/surrogates/${surrogateId}`);
      } else {
        setError(res.error?.message ?? 'Failed to update surrogate');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setSaving(false);
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Surrogate</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Update the surrogate configuration
        </p>
      </div>

      <Card>
        {error && (
          <div className="mb-4 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Role Title"
            placeholder="e.g. Senior Compliance Officer"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Domain
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Jurisdiction"
            placeholder="e.g. United States, California"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            required
          />

          <hr className="border-[var(--color-border)]" />

          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Configuration
          </p>

          <Input
            label="Seniority"
            placeholder="e.g. Senior, Principal, Director"
            value={seniority}
            onChange={(e) => setSeniority(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Risk Tolerance
            </label>
            <select
              value={riskTolerance}
              onChange={(e) =>
                setRiskTolerance(e.target.value as 'low' | 'medium' | 'high')
              }
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {RISK_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Assertiveness ({assertiveness}/10)
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={assertiveness}
              onChange={(e) => setAssertiveness(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Empathy Level ({empathyLevel}/10)
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={empathyLevel}
              onChange={(e) => setEmpathyLevel(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Communication Style
            </label>
            <select
              value={communicationStyle}
              onChange={(e) => setCommunicationStyle(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {COMMUNICATION_STYLES.map((style) => (
                <option key={style} value={style}>
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Escalation Threshold ({escalationThreshold})
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={escalationThreshold}
              onChange={(e) => setEscalationThreshold(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              0 = escalate everything, 1 = never escalate
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
