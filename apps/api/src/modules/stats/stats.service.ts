import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';

interface CountRow {
  count: bigint;
}

export interface DashboardStats {
  totalSurrogates: number;
  activeSurrogates: number;
  totalSOPs: number;
  certifiedSOPs: number;
  auditEntries24h: number;
}

export class StatsService {
  constructor(private readonly tenantManager: TenantManager) {}

  async getDashboardStats(tenant: TenantContext): Promise<DashboardStats> {
    const [totalSurrogates, activeSurrogates, totalSOPs, certifiedSOPs, auditEntries24h] =
      await Promise.all([
        this.count(tenant, `SELECT COUNT(*) as count FROM surrogates WHERE status != 'ARCHIVED'`),
        this.count(tenant, `SELECT COUNT(*) as count FROM surrogates WHERE status = 'ACTIVE'`),
        this.count(tenant, `SELECT COUNT(*) as count FROM sops`),
        this.count(tenant, `SELECT COUNT(*) as count FROM sops WHERE status = 'CERTIFIED'`),
        this.count(
          tenant,
          `SELECT COUNT(*) as count FROM audit_entries WHERE created_at > NOW() - INTERVAL '24 hours'`,
        ),
      ]);

    return {
      totalSurrogates,
      activeSurrogates,
      totalSOPs,
      certifiedSOPs,
      auditEntries24h,
    };
  }

  private async count(tenant: TenantContext, sql: string): Promise<number> {
    const rows = await this.tenantManager.executeInTenant<CountRow[]>(tenant.orgSlug, sql);
    return Number(rows[0]?.count ?? 0);
  }
}
