'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, FileText, Shield } from 'lucide-react';
import { Card, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, StatusBadge } from '@/components/ui';
import { apiClient } from '@/lib/api';

// Redirect /dashboard to this route group's page
export default function DashboardPage() {
  return <DashboardHome />;
}

interface DashboardStats {
  totalSurrogates: number;
  totalSOPs: number;
  auditEntries24h: number;
}

interface AuditEntryRow {
  id: string;
  action: string;
  surrogateId: string | null;
  confidence: number | null;
  createdAt: string;
}

function DashboardHome() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSurrogates: 0,
    totalSOPs: 0,
    auditEntries24h: 0,
  });
  const [recentAudit, setRecentAudit] = useState<AuditEntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [surrogatesRes, sopsRes, auditRes] = await Promise.all([
          apiClient.get<{ total: number }>('/surrogates?pageSize=1'),
          apiClient.get<{ total: number }>('/sops?pageSize=1'),
          apiClient.get<{ data: AuditEntryRow[]; total: number }>(
            '/audit?pageSize=10',
          ),
        ]);

        setStats({
          totalSurrogates: surrogatesRes.data?.total ?? 0,
          totalSOPs: sopsRes.data?.total ?? 0,
          auditEntries24h: auditRes.data?.total ?? 0,
        });

        setRecentAudit(auditRes.data?.data ?? []);
      } catch {
        // API may not be running yet
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const statCards = [
    {
      label: 'Total Surrogates',
      value: stats.totalSurrogates,
      icon: Bot,
      color: 'var(--color-primary)',
    },
    {
      label: 'Total SOPs',
      value: stats.totalSOPs,
      icon: FileText,
      color: 'var(--color-accent)',
    },
    {
      label: 'Audit Entries (24h)',
      value: stats.auditEntries24h,
      icon: Shield,
      color: 'var(--color-success)',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Overview of your AI surrogate platform
          </p>
        </div>
        <Link href="/surrogates/new">
          <Button>Create Surrogate</Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <div className="flex items-center gap-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold">
                    {loading ? (
                      <span className="inline-block h-7 w-12 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent audit */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Activity</h3>
            <Link
              href="/audit"
              className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            >
              View all
            </Link>
          </div>
        }
        padding={false}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : recentAudit.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            No audit entries yet. Create a surrogate to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Surrogate</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentAudit.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <StatusBadge status={entry.action.replace(/_/g, ' ')} />
                  </TableCell>
                  <TableCell>{entry.surrogateId ?? '-'}</TableCell>
                  <TableCell>
                    {entry.confidence != null
                      ? `${(entry.confidence * 100).toFixed(0)}%`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
