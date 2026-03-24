import { computeAuditHash } from './crypto.js';
import type { TenantManager } from '../tenancy/tenant-manager.js';
import type { AuditAction } from '@surrogate-os/shared';

export async function createAuditEntry(
  tenantManager: TenantManager,
  orgSlug: string,
  input: {
    surrogateId: string | null;
    userId: string;
    action: AuditAction;
    details: Record<string, unknown>;
  },
): Promise<void> {
  const now = new Date();
  const lastEntries = await tenantManager.executeInTenant<{ hash: string }[]>(
    orgSlug,
    'SELECT hash FROM audit_entries ORDER BY created_at DESC LIMIT 1',
  );
  const previousHash = lastEntries.length > 0 ? lastEntries[0].hash : null;
  const hash = computeAuditHash(previousHash, input.action, now, input.surrogateId);
  await tenantManager.executeInTenant(
    orgSlug,
    `INSERT INTO audit_entries (surrogate_id, user_id, action, details, previous_hash, hash, created_at)
     VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7)`,
    [input.surrogateId, input.userId, input.action, JSON.stringify(input.details), previousHash, hash, now],
  );
}
