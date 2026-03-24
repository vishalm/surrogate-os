'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  ScrollText,
  Settings,
  LogOut,
  Database,
  Brain,
  ClipboardList,
  GitPullRequest,
  Radar,
  Store,
  UserCog,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Network,
  Play,
  BarChart3,
  Activity,
  Search,
  MessageSquare,
} from 'lucide-react';
import { AuthProvider, useAuth, isAuthenticated, getUserFromToken } from '@/lib/auth';
import { NotificationBell } from '@/components/notification-bell';
import { SearchCommand } from '@/components/search-command';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Fleet', href: '/fleet', icon: Radar },
  { label: 'Surrogates', href: '/surrogates', icon: Bot },
  { label: 'SOPs', href: '/sops', icon: GitBranch },
  { label: 'Executions', href: '/executions', icon: Play },
  { label: 'Audit Log', href: '/audit', icon: ScrollText },
  { label: 'Activity', href: '/activity', icon: Activity },
  { label: 'Org DNA', href: '/org-dna', icon: Database },
  { label: 'Memory', href: '/memory', icon: Brain },
  { label: 'Debriefs', href: '/debriefs', icon: ClipboardList },
  { label: 'Proposals', href: '/proposals', icon: GitPullRequest },
  { label: 'Personas', href: '/personas', icon: UserCog },
  { label: 'Marketplace', href: '/marketplace', icon: Store },
  { label: 'Bias Audit', href: '/bias', icon: ShieldCheck },
  { label: 'Compliance', href: '/compliance', icon: ShieldAlert },
  { label: 'Humanoid', href: '/humanoid', icon: Cpu },
  { label: 'Federation', href: '/federation', icon: Network },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-6 backdrop-blur-sm">
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
              title="Search (Ctrl+K)"
            >
              <Search className="h-4.5 w-4.5" />
            </button>
            <NotificationBell />
          </div>
        </header>

        <div className="p-6">{children}</div>
      </main>

      <SearchCommand open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Floating Chat Button */}
      {pathname !== '/chat' && (
        <button
          onClick={() => router.push('/chat')}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95"
          title="Chat with Surrogates"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}
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
