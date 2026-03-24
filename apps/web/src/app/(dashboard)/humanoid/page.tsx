'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Plus, AlertTriangle } from 'lucide-react';
import {
  Card,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  StatusBadge,
  Pagination,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { PaginatedResponse } from '@surrogate-os/shared';

const PAGE_SIZE = 20;
const POLL_INTERVAL = 15_000;

interface HumanoidDevice {
  id: string;
  name: string;
  modality: string;
  status: string;
  lastHeartbeat: string | null;
  errorCount: number;
  uptimeSeconds: number;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'muted'> = {
  ONLINE: 'success',
  OFFLINE: 'muted',
  MAINTENANCE: 'warning',
  ERROR: 'danger',
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

export default function HumanoidPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<HumanoidDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showRegister, setShowRegister] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerModality, setRegisterModality] = useState('CHAT');
  const [registering, setRegistering] = useState(false);

  const fetchDevices = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<HumanoidDevice>>(
        `/humanoid/devices?page=${currentPage}&pageSize=${PAGE_SIZE}`,
      );
      if (res.success && res.data) {
        setDevices(res.data.data);
        setTotalPages(res.data.totalPages ?? 1);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices(page);
  }, [page, fetchDevices]);

  // Poll for status updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDevices(page);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [page, fetchDevices]);

  const handleRegister = async () => {
    if (!registerName.trim()) return;
    setRegistering(true);
    try {
      const res = await apiClient.post('/humanoid/devices', {
        name: registerName.trim(),
        modality: registerModality,
      });
      if (res.success) {
        setShowRegister(false);
        setRegisterName('');
        setRegisterModality('CHAT');
        fetchDevices(page);
      }
    } catch {
      // handle error
    } finally {
      setRegistering(false);
    }
  };

  const handleKillSwitch = async (deviceId: string, level: string) => {
    if (!confirm(`Are you sure you want to trigger ${level} on this device? This action cannot be undone.`)) {
      return;
    }
    try {
      await apiClient.post(`/humanoid/devices/${deviceId}/kill-switch`, { level });
      fetchDevices(page);
    } catch {
      // handle error
    }
  };

  const statusCounts = {
    online: devices.filter((d) => d.status === 'ONLINE').length,
    offline: devices.filter((d) => d.status === 'OFFLINE').length,
    maintenance: devices.filter((d) => d.status === 'MAINTENANCE').length,
    error: devices.filter((d) => d.status === 'ERROR').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Humanoid SDK</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage humanoid devices and interface modalities
          </p>
        </div>
        <Button onClick={() => setShowRegister(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Register Device
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Online</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                {statusCounts.online}
              </p>
            </div>
            <Badge variant="success">Online</Badge>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Offline</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                {statusCounts.offline}
              </p>
            </div>
            <Badge variant="muted">Offline</Badge>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Maintenance</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                {statusCounts.maintenance}
              </p>
            </div>
            <Badge variant="warning">Maint.</Badge>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Error</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                {statusCounts.error}
              </p>
            </div>
            <Badge variant="danger">Error</Badge>
          </div>
        </Card>
      </div>

      {/* Register Device Modal */}
      {showRegister && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
            Register New Device
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                Device Name
              </label>
              <input
                type="text"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                placeholder="e.g. Warehouse Robot A1"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                Modality
              </label>
              <select
                value={registerModality}
                onChange={(e) => setRegisterModality(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
              >
                {Object.entries(MODALITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRegister} disabled={registering || !registerName.trim()}>
                {registering ? 'Registering...' : 'Register'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRegister(false);
                  setRegisterName('');
                  setRegisterModality('CHAT');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Device Table */}
      <Card padding={false}>
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Registered Devices
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <Cpu className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No devices registered
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Register a humanoid device to get started
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Modality</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Heartbeat</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Kill Switch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell
                      className="cursor-pointer font-medium text-[var(--color-text-primary)]"
                      onClick={() => router.push(`/humanoid/${device.id}`)}
                    >
                      {device.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {MODALITY_LABELS[device.modality] ?? device.modality}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[device.status] ?? 'default'}>
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {device.lastHeartbeat
                        ? new Date(device.lastHeartbeat).toLocaleString()
                        : '--'}
                    </TableCell>
                    <TableCell>
                      <span className={device.errorCount > 0 ? 'text-[var(--color-danger)]' : ''}>
                        {device.errorCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleKillSwitch(device.id, 'EMERGENCY_KILL');
                        }}
                        className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                        title="Emergency Kill Switch"
                      >
                        <AlertTriangle className="mr-1 inline h-3 w-3" />
                        KILL
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 pb-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
