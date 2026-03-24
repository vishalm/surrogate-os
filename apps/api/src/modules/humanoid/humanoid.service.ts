import type { PrismaClient } from '@prisma/client';
import type { PaginatedResponse } from '@surrogate-os/shared';
import { AuditAction } from '@surrogate-os/shared';
import type { TenantContext } from '../../tenancy/tenant-context.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import { createAuditEntry } from '../../lib/audit-helper.js';
import {
  type DeviceStatus,
  type HardStopConfig,
  type InterfaceModality,
  KillSwitchLevel,
  DEFAULT_HARD_STOP_CONFIG,
} from './interfaces.js';
import { translateTask, type TranslationContext } from './task-translator.js';

// --- Row interfaces (snake_case from DB) ---

interface DeviceRow {
  id: string;
  name: string;
  modality: string;
  status: string;
  hard_stop_config: HardStopConfig;
  capabilities: string[];
  last_heartbeat: Date | null;
  metadata: Record<string, unknown>;
  error_count: number;
  uptime_seconds: number;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: bigint;
}

interface SOPNodeRow {
  id: string;
  type: string;
  label: string;
  description: string;
  config: Record<string, unknown>;
}

interface SOPRow {
  id: string;
  title: string;
  graph: {
    nodes: SOPNodeRow[];
    edges: unknown[];
  };
}

// --- Row mapper ---

function mapDeviceRow(row: DeviceRow) {
  return {
    id: row.id,
    name: row.name,
    modality: row.modality,
    status: row.status,
    hardStopConfig: row.hard_stop_config,
    capabilities: row.capabilities,
    lastHeartbeat: row.last_heartbeat,
    metadata: row.metadata,
    errorCount: row.error_count,
    uptimeSeconds: row.uptime_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Input interfaces ---

export interface RegisterDeviceInput {
  name: string;
  modality: InterfaceModality;
  capabilities?: string[];
  hardStopConfig?: Partial<HardStopConfig>;
  metadata?: Record<string, unknown>;
}

// --- Service ---

export class HumanoidService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantManager: TenantManager,
  ) {}

  async registerDevice(
    tenant: TenantContext,
    input: RegisterDeviceInput,
    userId: string,
  ) {
    const hardStopConfig: HardStopConfig = {
      ...DEFAULT_HARD_STOP_CONFIG,
      ...input.hardStopConfig,
    };

    const rows = await this.tenantManager.executeInTenant<DeviceRow[]>(
      tenant.orgSlug,
      `INSERT INTO humanoid_devices (name, modality, capabilities, hard_stop_config, metadata)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
       RETURNING *`,
      [
        input.name,
        input.modality,
        JSON.stringify(input.capabilities ?? []),
        JSON.stringify(hardStopConfig),
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.HUMANOID_DEVICE_REGISTERED,
      details: { deviceId: rows[0].id, name: input.name, modality: input.modality },
    });

    return mapDeviceRow(rows[0]);
  }

  async listDevices(
    tenant: TenantContext,
    pagination: PaginationParams,
    filters?: { status?: string; modality?: string },
  ): Promise<PaginatedResponse<ReturnType<typeof mapDeviceRow>>> {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters?.modality) {
      whereClauses.push(`modality = $${paramIndex++}`);
      params.push(filters.modality);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await this.tenantManager.executeInTenant<CountRow[]>(
      tenant.orgSlug,
      `SELECT COUNT(*) as count FROM humanoid_devices ${where}`,
      params,
    );
    const total = Number(countRows[0].count);

    const rows = await this.tenantManager.executeInTenant<DeviceRow[]>(
      tenant.orgSlug,
      `SELECT * FROM humanoid_devices ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pagination.take, pagination.skip],
    );

    return buildPaginatedResponse(
      rows.map(mapDeviceRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getDevice(tenant: TenantContext, id: string) {
    const rows = await this.tenantManager.executeInTenant<DeviceRow[]>(
      tenant.orgSlug,
      `SELECT * FROM humanoid_devices WHERE id = $1::uuid`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError('Humanoid device not found');
    }

    return mapDeviceRow(rows[0]);
  }

  async updateDeviceStatus(
    tenant: TenantContext,
    id: string,
    status: DeviceStatus,
    userId: string,
  ) {
    const validStatuses: DeviceStatus[] = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'ERROR'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid device status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Verify device exists
    await this.getDevice(tenant, id);

    const rows = await this.tenantManager.executeInTenant<DeviceRow[]>(
      tenant.orgSlug,
      `UPDATE humanoid_devices
       SET status = $1, updated_at = $2, last_heartbeat = $2
       WHERE id = $3::uuid
       RETURNING *`,
      [status, new Date(), id],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.HUMANOID_DEVICE_STATUS_CHANGED,
      details: { deviceId: id, status },
    });

    return mapDeviceRow(rows[0]);
  }

  async triggerKillSwitch(
    tenant: TenantContext,
    deviceId: string,
    level: KillSwitchLevel,
    userId: string,
  ) {
    const device = await this.getDevice(tenant, deviceId);

    // Validate the kill switch level is enabled in the device's hard stop config
    const config = device.hardStopConfig as HardStopConfig;
    if (level === KillSwitchLevel.SOFT_PAUSE && !config.softPauseEnabled) {
      throw new ValidationError('Soft pause is not enabled on this device');
    }
    if (level === KillSwitchLevel.FULL_STOP && !config.fullStopEnabled) {
      throw new ValidationError('Full stop is not enabled on this device');
    }
    if (level === KillSwitchLevel.EMERGENCY_KILL && !config.emergencyKillEnabled) {
      throw new ValidationError('Emergency kill is not enabled on this device');
    }

    // Determine new device status based on kill switch level
    let newStatus: DeviceStatus;
    switch (level) {
      case KillSwitchLevel.SOFT_PAUSE:
        newStatus = 'MAINTENANCE';
        break;
      case KillSwitchLevel.FULL_STOP:
      case KillSwitchLevel.EMERGENCY_KILL:
        newStatus = 'OFFLINE';
        break;
      default:
        newStatus = 'OFFLINE';
    }

    const rows = await this.tenantManager.executeInTenant<DeviceRow[]>(
      tenant.orgSlug,
      `UPDATE humanoid_devices
       SET status = $1, updated_at = $2
       WHERE id = $3::uuid
       RETURNING *`,
      [newStatus, new Date(), deviceId],
    );

    await createAuditEntry(this.tenantManager, tenant.orgSlug, {
      surrogateId: null,
      userId,
      action: AuditAction.HUMANOID_KILL_SWITCH_TRIGGERED,
      details: {
        deviceId,
        level,
        previousStatus: device.status,
        newStatus,
      },
    });

    return {
      device: mapDeviceRow(rows[0]),
      killSwitchLevel: level,
      triggeredAt: new Date().toISOString(),
    };
  }

  async translateSopForDevice(
    tenant: TenantContext,
    sopId: string,
    deviceId: string,
  ) {
    // Fetch device
    const device = await this.getDevice(tenant, deviceId);

    // Fetch SOP with graph
    const sopRows = await this.tenantManager.executeInTenant<SOPRow[]>(
      tenant.orgSlug,
      `SELECT id, title, graph FROM sops WHERE id = $1::uuid`,
      [sopId],
    );

    if (sopRows.length === 0) {
      throw new NotFoundError('SOP not found');
    }

    const sop = sopRows[0];
    const graph = sop.graph;

    if (!graph.nodes || graph.nodes.length === 0) {
      throw new ValidationError('SOP has no nodes to translate');
    }

    // Default context — callers can override via future enhancements
    const context: TranslationContext = {
      humanProximity: false,
      medicalContext: false,
      environmentType: 'INDOOR',
    };

    // Translate each SOP node to physical actions
    const translations = graph.nodes.map((node) =>
      translateTask(
        {
          id: node.id,
          type: node.type as any,
          label: node.label,
          description: node.description ?? '',
          config: node.config ?? {},
        },
        device.modality as InterfaceModality,
        context,
      ),
    );

    return {
      sopId: sop.id,
      sopTitle: sop.title,
      deviceId: device.id,
      deviceName: device.name,
      modality: device.modality,
      translations,
      totalEstimatedDuration: translations.reduce((sum, t) => sum + t.estimatedDuration, 0),
    };
  }

  async getDeviceHealth(tenant: TenantContext, deviceId: string) {
    const device = await this.getDevice(tenant, deviceId);

    // Calculate uptime percentage based on status and uptime_seconds
    const now = new Date();
    const createdAt = new Date(device.createdAt);
    const totalLifetimeSeconds = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / 1000));
    const uptimePercentage = Math.min(100, (device.uptimeSeconds / totalLifetimeSeconds) * 100);

    // Determine heartbeat status
    let heartbeatStatus: 'HEALTHY' | 'STALE' | 'MISSING' = 'MISSING';
    if (device.lastHeartbeat) {
      const lastHeartbeat = new Date(device.lastHeartbeat);
      const config = device.hardStopConfig as HardStopConfig;
      const maxLatency = config.maxLatencyMs ?? 10000;
      const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();

      if (timeSinceHeartbeat < maxLatency) {
        heartbeatStatus = 'HEALTHY';
      } else if (timeSinceHeartbeat < maxLatency * 3) {
        heartbeatStatus = 'STALE';
      }
    }

    return {
      deviceId: device.id,
      deviceName: device.name,
      modality: device.modality,
      status: device.status,
      uptimeSeconds: device.uptimeSeconds,
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      errorCount: device.errorCount,
      lastHeartbeat: device.lastHeartbeat,
      heartbeatStatus,
      hardStopConfig: device.hardStopConfig,
    };
  }
}
