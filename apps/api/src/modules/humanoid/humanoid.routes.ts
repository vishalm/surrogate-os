import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { paginationSchema, UserRole } from '@surrogate-os/shared';
import { z } from 'zod';
import { HumanoidService } from './humanoid.service.js';
import { InterfaceModality, KillSwitchLevel } from './interfaces.js';
import type { TenantManager } from '../../tenancy/tenant-manager.js';
import { authGuard, requireRole } from '../../middleware/auth.js';
import { parsePagination } from '../../lib/pagination.js';
import { ValidationError } from '../../lib/errors.js';

interface HumanoidRoutesOptions {
  prisma: PrismaClient;
  tenantManager: TenantManager;
}

// --- Validation schemas ---

const registerDeviceSchema = z.object({
  name: z.string().min(1).max(200),
  modality: z.nativeEnum(InterfaceModality),
  capabilities: z.array(z.string()).optional(),
  hardStopConfig: z.object({
    softPauseEnabled: z.boolean().optional(),
    fullStopEnabled: z.boolean().optional(),
    emergencyKillEnabled: z.boolean().optional(),
    heartbeatIntervalMs: z.number().int().min(1000).optional(),
    maxLatencyMs: z.number().int().min(1000).optional(),
    requireDualAuth: z.boolean().optional(),
    authorizedOperators: z.array(z.string()).optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE', 'ERROR']),
});

const killSwitchSchema = z.object({
  level: z.nativeEnum(KillSwitchLevel),
});

const humanoidRoutesCallback: FastifyPluginCallback<HumanoidRoutesOptions> = (
  fastify: FastifyInstance,
  opts,
  done,
) => {
  const service = new HumanoidService(opts.prisma, opts.tenantManager);
  const guard = authGuard(opts.prisma);
  const ownerAdminGuard = requireRole([UserRole.OWNER, UserRole.ADMIN]);

  // POST /devices — Register a new humanoid device
  fastify.post(
    '/devices',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = registerDeviceSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', {
          issues: parsed.error.issues,
        });
      }

      const device = await service.registerDevice(
        request.tenant!,
        parsed.data,
        request.user!.id,
      );
      return reply.status(201).send({ success: true, data: device, error: null });
    },
  );

  // GET /devices — List all devices
  fastify.get(
    '/devices',
    { preHandler: [guard] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const paginationParsed = paginationSchema.safeParse(query);
      const pagination = parsePagination(
        paginationParsed.success ? paginationParsed.data : {},
      );

      const filters: { status?: string; modality?: string } = {};
      if (query.status) filters.status = query.status;
      if (query.modality) filters.modality = query.modality;

      const result = await service.listDevices(request.tenant!, pagination, filters);
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /devices/:id — Device detail
  fastify.get<{ Params: { id: string } }>(
    '/devices/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const device = await service.getDevice(request.tenant!, request.params.id);
      return reply.send({ success: true, data: device, error: null });
    },
  );

  // PATCH /devices/:id/status — Update device status
  fastify.patch<{ Params: { id: string } }>(
    '/devices/:id/status',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = updateStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid status', {
          issues: parsed.error.issues,
        });
      }

      const device = await service.updateDeviceStatus(
        request.tenant!,
        request.params.id,
        parsed.data.status,
        request.user!.id,
      );
      return reply.send({ success: true, data: device, error: null });
    },
  );

  // POST /devices/:id/kill-switch — Trigger kill switch (OWNER/ADMIN only)
  fastify.post<{ Params: { id: string } }>(
    '/devices/:id/kill-switch',
    { preHandler: [guard, ownerAdminGuard] },
    async (request, reply) => {
      const parsed = killSwitchSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid kill switch level', {
          issues: parsed.error.issues,
        });
      }

      const result = await service.triggerKillSwitch(
        request.tenant!,
        request.params.id,
        parsed.data.level,
        request.user!.id,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // POST /translate/:sopId/:deviceId — Translate SOP for device
  fastify.post<{ Params: { sopId: string; deviceId: string } }>(
    '/translate/:sopId/:deviceId',
    { preHandler: [guard] },
    async (request, reply) => {
      const result = await service.translateSopForDevice(
        request.tenant!,
        request.params.sopId,
        request.params.deviceId,
      );
      return reply.send({ success: true, data: result, error: null });
    },
  );

  // GET /devices/:id/health — Device health metrics
  fastify.get<{ Params: { id: string } }>(
    '/devices/:id/health',
    { preHandler: [guard] },
    async (request, reply) => {
      const health = await service.getDeviceHealth(
        request.tenant!,
        request.params.id,
      );
      return reply.send({ success: true, data: health, error: null });
    },
  );

  done();
};

export const humanoidRoutes = humanoidRoutesCallback;
