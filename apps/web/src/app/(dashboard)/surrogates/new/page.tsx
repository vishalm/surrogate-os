'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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

export default function NewSurrogatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [roleTitle, setRoleTitle] = useState('');
  const [domain, setDomain] = useState(DOMAINS[0]);
  const [jurisdiction, setJurisdiction] = useState('');
  const [seniority, setSeniority] = useState('');
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'medium' | 'high'>('medium');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        roleTitle,
        domain,
        jurisdiction,
      };

      if (seniority || riskTolerance) {
        body.config = {
          ...(seniority && { seniority }),
          ...(riskTolerance && { riskTolerance }),
        };
      }

      const res = await apiClient.post<Surrogate>('/surrogates', body);

      if (res.success) {
        router.push('/surrogates');
      } else {
        setError(res.error?.message ?? 'Failed to create surrogate');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Surrogate</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Define a new AI identity surrogate for your organization
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
            Optional Configuration
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

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>
              Create Surrogate
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
