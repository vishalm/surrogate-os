'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Heart, Activity, Clock, AlertCircle } from 'lucide-react';
import {
  Card,
  Badge,
  Button,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'muted'> = {
  ONLINE: 'success',
  OFFLINE: 'muted',
  MAINTENANCE: 'warning',
  ERROR: 'danger',
};

const HEARTBEAT_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  HEALTHY: 'success',
  STALE: 'warning',
  MISSING: 'danger',
};

const MODALITY_LABELS: Record<string, string> = {
  CHAT: 'Chat',
  VOICE: 'Voice',
  AVATAR: 'Avatar',
  AR_OVERLAY: 'AR Overlay',
  EXOSUIT: 'Exosuit',
  COLLABORATIVE_ROBOT: 'Collaborative Robot',
  SEMI_AUTONOMOUS: 'Semi-Autonomous',
  FULLY_AUTONOMOUS: 'Fully Autonomous',
};

const KILL_SWITCH_LEVELS = [
  {
    level: 'SOFT_PAUSE',
    label: 'Soft Pause',
    description: 'Pause current task, maintain state',
    color: 'bg-yellow-500 hover:bg-yellow-600',
  },
  {
    level: 'FULL_STOP',
    label: 'Full Stop',
    description: 'Stop all operations, safe state',
    color: 'bg-orange-600 hover:bg-orange-700',
  },
  {
    level: 'EMERGENCY_KILL',
    label: 'Emergency Kill',
    description: 'Immediate halt, no state preservation',
    color: 'bg-red-600 hover:bg-red-700',
  },
];

interface DeviceDetail {
  id: string;
  name: string;
  modality: string;
  status: string;
  hardStopConfig: {
    softPauseEnabled: boolean;
    fullStopEnabled: boolean;
    emergencyKillEnabled: boolean;
    heartbeatIntervalMs: number;
    maxLatencyMs: number;
    requireDualAuth: boolean;
    authorizedOperators: string[];
  };
  capabilities: string[];
  lastHeartbeat: string | null;
  metadata: Record<string, unknown>;
  errorCount: number;
  uptimeSeconds: number;
  createdAt: string;
  updatedAt: string;
}

interface DeviceHealth {
  deviceId: string;
  deviceName: string;
  modality: string;
  status: string;
  uptimeSeconds: number;
  uptimePercentage: number;
  errorCount: number;
  lastHeartbeat: string | null;
  heartbeatStatus: 'HEALTHY' | 'STALE' | 'MISSING';
  hardStopConfig: Record<string, unknown>;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export default function HumanoidDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [health, setHealth] = useState<DeviceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [killSwitchLoading, setKillSwitchLoading] = useState<string | null>(null);

  const fetchDevice = useCallback(async () => {
    try {
      const res = await apiClient.get<DeviceDetail>(`/humanoid/devices/${deviceId}`);
      if (res.success && res.data) {
        setDevice(res.data);
      }
    } catch {
      // handle error
    }
  }, [deviceId]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await apiClient.get<DeviceHealth>(`/humanoid/devices/${deviceId}/health`);
      if (res.success && res.data) {
        setHealth(res.data);
      }
    } catch {
      // handle error
    }
  }, [deviceId]);

  useEffect(() => {
    Promise.all([fetchDevice(), fetchHealth()]).finally(() => setLoading(false));
  }, [fetchDevice, fetchHealth]);

  // Poll health every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHealth();
      fetchDevice();
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchDevice]);

  const handleKillSwitch = async (level: string) => {
    const levelLabel = KILL_SWITCH_LEVELS.find((k) => k.level === level)?.label ?? level;
    if (
      !confirm(
        `Are you sure you want to trigger "${levelLabel}" on "${device?.name}"? This will change the device state.`,
      )
    ) {
      return;
    }

    setKillSwitchLoading(level);
    try {
      await apiClient.post(`/humanoid/devices/${deviceId}/kill-switch`, { level });
      await fetchDevice();
      await fetchHealth();
    } catch {
      // handle error
    } finally {
      setKillSwitchLoading(null);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await apiClient.patch(`/humanoid/devices/${deviceId}/status`, { status });
      await fetchDevice();
      await fetchHealth();
    } catch {
      // handle error
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Device not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push('/humanoid')}
          className="mb-3 flex items-center gap-1 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Devices
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{device.name}</h1>
            <div className="mt-1 flex items-center gap-3">
              <Badge variant="default">
                {MODALITY_LABELS[device.modality] ?? device.modality}
              </Badge>
              <Badge variant={STATUS_VARIANT[device.status] ?? 'default'}>
                {device.status}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            {device.status === 'OFFLINE' && (
              <Button onClick={() => handleStatusChange('ONLINE')}>
                Bring Online
              </Button>
            )}
            {device.status === 'ONLINE' && (
              <Button variant="secondary" onClick={() => handleStatusChange('MAINTENANCE')}>
                Set Maintenance
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Health Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)]">
              <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Uptime</p>
              <p className="mt-0.5 text-lg font-bold text-[var(--color-text-primary)]">
                {formatUptime(health?.uptimeSeconds ?? 0)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {health?.uptimePercentage?.toFixed(1) ?? 0}%
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)]">
              <Heart className="h-4 w-4 text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Heartbeat</p>
              <Badge variant={HEARTBEAT_VARIANT[health?.heartbeatStatus ?? 'MISSING']}>
                {health?.heartbeatStatus ?? 'MISSING'}
              </Badge>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {health?.lastHeartbeat
                  ? new Date(health.lastHeartbeat).toLocaleTimeString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)]">
              <AlertCircle className="h-4 w-4 text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Errors</p>
              <p className={`mt-0.5 text-lg font-bold ${(health?.errorCount ?? 0) > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
                {health?.errorCount ?? 0}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)]">
              <Activity className="h-4 w-4 text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Status</p>
              <Badge variant={STATUS_VARIANT[device.status] ?? 'default'}>
                {device.status}
              </Badge>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                Since {new Date(device.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Kill Switch Controls */}
      <Card>
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Kill Switch Controls
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Emergency controls to halt device operations. Use with caution.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {KILL_SWITCH_LEVELS.map((ks) => {
            const configKey = ks.level === 'SOFT_PAUSE'
              ? 'softPauseEnabled'
              : ks.level === 'FULL_STOP'
                ? 'fullStopEnabled'
                : 'emergencyKillEnabled';
            const isEnabled = device.hardStopConfig?.[configKey] !== false;

            return (
              <div
                key={ks.level}
                className="rounded-lg border border-[var(--color-border)] p-4"
              >
                <h3 className="font-medium text-[var(--color-text-primary)]">{ks.label}</h3>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{ks.description}</p>
                <button
                  onClick={() => handleKillSwitch(ks.level)}
                  disabled={!isEnabled || killSwitchLoading === ks.level}
                  className={`mt-3 w-full rounded-md px-3 py-2 text-sm font-medium text-white transition-colors ${
                    isEnabled ? ks.color : 'cursor-not-allowed bg-gray-400'
                  }`}
                >
                  {killSwitchLoading === ks.level ? 'Triggering...' : ks.label}
                </button>
                {!isEnabled && (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Disabled in config</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Device Configuration */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          Device Configuration
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Heartbeat Interval
            </p>
            <p className="text-sm text-[var(--color-text-primary)]">
              {device.hardStopConfig?.heartbeatIntervalMs ?? 5000}ms
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Max Latency
            </p>
            <p className="text-sm text-[var(--color-text-primary)]">
              {device.hardStopConfig?.maxLatencyMs ?? 10000}ms
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Dual Auth Required
            </p>
            <p className="text-sm text-[var(--color-text-primary)]">
              {device.hardStopConfig?.requireDualAuth ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Capabilities
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(device.capabilities ?? []).length > 0 ? (
                device.capabilities.map((cap, idx) => (
                  <Badge key={idx} variant="default">
                    {cap}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-[var(--color-text-muted)]">None configured</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Metadata */}
      {device.metadata && Object.keys(device.metadata).length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
            Metadata
          </h2>
          <pre className="overflow-x-auto rounded-lg bg-[var(--color-bg-elevated)] p-4 text-xs text-[var(--color-text-secondary)]">
            {JSON.stringify(device.metadata, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
