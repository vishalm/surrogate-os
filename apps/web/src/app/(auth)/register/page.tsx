'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { setTokens } from '@/lib/auth';

interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export default function RegisterPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    if (!slugEdited) {
      setOrgSlug(slugify(value));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiClient.post<RegisterResponse>('/auth/register', {
        orgName,
        orgSlug,
        name,
        email,
        password,
      });

      if (res.success && res.data) {
        setTokens(res.data.accessToken, res.data.refreshToken);
        router.push('/dashboard');
      } else {
        setError(res.error?.message ?? 'Registration failed');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-6 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <span className="text-lg font-bold">Surrogate OS</span>
        </div>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
          Create your organization
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Set up your workspace and start building AI surrogates
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Organization Name"
          placeholder="Acme Corp"
          value={orgName}
          onChange={(e) => handleOrgNameChange(e.target.value)}
          required
        />
        <Input
          label="Organization Slug"
          placeholder="acme-corp"
          value={orgSlug}
          onChange={(e) => {
            setOrgSlug(e.target.value);
            setSlugEdited(true);
          }}
          required
        />
        <hr className="border-[var(--color-border)]" />
        <Input
          label="Your Name"
          placeholder="Jane Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          placeholder="jane@acme.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Create Organization
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
        >
          Sign in
        </Link>
      </p>
    </Card>
  );
}
