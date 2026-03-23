import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Surrogate OS
          </h1>
        </div>
        <p className="mb-8 text-sm text-[var(--color-text-secondary)]">
          AI Identity Engine — Multi-Tenant Platform
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)]"
          >
            Create Organization
          </Link>
        </div>
      </div>
    </div>
  );
}
