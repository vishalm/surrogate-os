'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { setTokens } from '@/lib/auth';

interface LoginResponse {
  user: { id: string; email: string; name: string; role: string };
  org: { id: string; name: string; slug: string };
  tokens: { accessToken: string; refreshToken: string };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiClient.post<LoginResponse>('/auth/login', {
        email,
        password,
      });

      if (res.success && res.data) {
        setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
        router.push('/dashboard');
      } else {
        setError(res.error?.message ?? 'Invalid credentials');
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
          Sign in to your account
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Enter your credentials to continue
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Sign In
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
        >
          Create organization
        </Link>
      </p>
    </Card>
  );
}
