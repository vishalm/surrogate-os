'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { PersonaTemplate } from '@surrogate-os/shared';

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
  'professional',
  'conversational',
  'empathetic',
  'direct',
];

export default function NewPersonaTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Template fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState(DOMAINS[0]);
  const [jurisdiction, setJurisdiction] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Base config fields
  const [seniority, setSeniority] = useState(5);
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'medium' | 'high'>('medium');
  const [assertiveness, setAssertiveness] = useState(5);
  const [empathyLevel, setEmpathyLevel] = useState(5);
  const [communicationStyle, setCommunicationStyle] = useState(COMMUNICATION_STYLES[0]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const body = {
        name,
        description: description || undefined,
        domain,
        jurisdiction,
        category: category || undefined,
        tags: tags.length > 0 ? tags : undefined,
        baseConfig: {
          seniority,
          riskTolerance,
          assertiveness,
          empathyLevel,
          communicationStyle,
        },
      };

      const res = await apiClient.post<PersonaTemplate>('/personas', body);

      if (res.success) {
        router.push('/personas');
      } else {
        setError(res.error?.message ?? 'Failed to create persona template');
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
        <h1 className="text-2xl font-bold">Create Persona Template</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Define a reusable persona template for creating surrogates
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
            label="Name"
            placeholder="e.g. Senior Compliance Specialist"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the persona template purpose and characteristics..."
              rows={3}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

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

          <Input
            label="Category"
            placeholder="e.g. Compliance, Customer Service"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <Input
            label="Tags (comma-separated)"
            placeholder="e.g. compliance, regulatory, senior"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />

          <hr className="border-[var(--color-border)]" />

          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Base Configuration
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Seniority (1-10): {seniority}
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={seniority}
              onChange={(e) => setSeniority(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>

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
              Assertiveness (1-10): {assertiveness}
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={assertiveness}
              onChange={(e) => setAssertiveness(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Empathy Level (1-10): {empathyLevel}
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={empathyLevel}
              onChange={(e) => setEmpathyLevel(parseInt(e.target.value, 10))}
              className="w-full"
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

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>
              Create Template
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
