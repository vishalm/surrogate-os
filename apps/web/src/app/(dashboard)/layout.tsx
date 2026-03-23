'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Bot,
  FileText,
  Shield,
  Settings,
  LogOut,
} from 'lucide-react';
import { AuthProvider, useAuth, isAuthenticated, getUserFromToken } from '@/lib/auth';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Surrogates', href: '/surrogates', icon: Bot },
  { label: 'SOPs', href: '/sops', icon: FileText },
  { label: 'Audit Log', href: '/audit', icon: Shield },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-card)]">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border)] px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)]">
            <span className="text-xs font-bold text-white">S</span>
          </div>
          <span className="text-sm font-bold tracking-tight">Surrogate OS</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-[var(--color-border)] p-3">
          <div className="flex items-center justify-between rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                {user?.name ?? 'User'}
              </p>
              <p className="truncate text-xs text-[var(--color-text-muted)]">
                {user?.email ?? ''}
              </p>
            </div>
            <button
              onClick={logout}
              className="ml-2 rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)]"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--color-text-muted)]">
              {user?.orgId ? 'Organization' : ''}
            </span>
            {pathname !== '/dashboard' && (
              <>
                <span className="text-[var(--color-text-muted)]">/</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {navItems.find(
                    (item) =>
                      pathname === item.href ||
                      (item.href !== '/dashboard' &&
                        pathname.startsWith(item.href)),
                  )?.label ?? 'Page'}
                </span>
              </>
            )}
          </div>
        </header>

        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
