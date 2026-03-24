import type { PrismaClient } from '@prisma/client';
import { randomBytes, createHmac } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import type { PaginatedResponse } from '@surrogate-os/shared';

const WEBHOOK_EVENTS = [
  'surrogate.created',
  'sop.certified',
  'session.completed',
  'debrief.generated',
  'proposal.approved',
  'compliance.check_completed',
  'execution.completed',
  'bias.check_completed',
] as const;

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

interface WebhookResult {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DeliveryResult {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  response: string | null;
  attempts: number;
  deliveredAt: Date | null;
  createdAt: Date;
}

function mapWebhookRow(row: {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): WebhookResult {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    active: row.active,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDeliveryRow(row: {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  response: string | null;
  attempts: number;
  deliveredAt: Date | null;
  createdAt: Date;
}): DeliveryResult {
  return {
    id: row.id,
    webhookId: row.webhookId,
    event: row.event,
    payload: row.payload,
    statusCode: row.statusCode,
    response: row.response,
    attempts: row.attempts,
    deliveredAt: row.deliveredAt,
    createdAt: row.createdAt,
  };
}

function generateSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export class WebhookService {
  constructor(private readonly prisma: PrismaClient) {}

  async registerWebhook(
    orgId: string,
    url: string,
    events: string[],
    secret: string | undefined,
    userId: string,
  ): Promise<WebhookResult & { secret: string }> {
    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new ValidationError('Invalid webhook URL');
    }

    // Validate events
    const invalidEvents = events.filter(
      (e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent),
    );
    if (invalidEvents.length > 0) {
      throw new ValidationError('Invalid webhook events', {
        invalidEvents,
        validEvents: [...WEBHOOK_EVENTS],
      });
    }

    const webhookSecret = secret || generateSecret();

    const row = await this.prisma.webhook.create({
      data: {
        orgId,
        url,
        events,
        secret: webhookSecret,
        createdBy: userId,
      },
    });

    return {
      ...mapWebhookRow(row),
      secret: webhookSecret,
    };
  }

  async listWebhooks(orgId: string): Promise<WebhookResult[]> {
    const rows = await this.prisma.webhook.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(mapWebhookRow);
  }

  async updateWebhook(
    orgId: string,
    id: string,
    updates: { url?: string; events?: string[]; active?: boolean },
  ): Promise<WebhookResult> {
    const existing = await this.prisma.webhook.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundError('Webhook not found');
    }

    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        throw new ValidationError('Invalid webhook URL');
      }
    }

    if (updates.events) {
      const invalidEvents = updates.events.filter(
        (e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent),
      );
      if (invalidEvents.length > 0) {
        throw new ValidationError('Invalid webhook events', {
          invalidEvents,
          validEvents: [...WEBHOOK_EVENTS],
        });
      }
    }

    const row = await this.prisma.webhook.update({
      where: { id },
      data: {
        ...(updates.url !== undefined && { url: updates.url }),
        ...(updates.events !== undefined && { events: updates.events }),
        ...(updates.active !== undefined && { active: updates.active }),
      },
    });

    return mapWebhookRow(row);
  }

  async deleteWebhook(orgId: string, id: string): Promise<void> {
    const existing = await this.prisma.webhook.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundError('Webhook not found');
    }

    // Delete deliveries first, then webhook
    await this.prisma.webhookDelivery.deleteMany({
      where: { webhookId: id },
    });

    await this.prisma.webhook.delete({
      where: { id },
    });
  }

  async triggerWebhook(
    orgId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        orgId,
        active: true,
        events: { has: event },
      },
    });

    for (const webhook of webhooks) {
      // Queue delivery for each matching webhook
      await this.deliverWebhook(webhook.id, webhook.url, webhook.secret, event, payload);
    }
  }

  async getDeliveryLog(
    orgId: string,
    webhookId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<DeliveryResult>> {
    // Verify webhook belongs to org
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, orgId },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    const total = await this.prisma.webhookDelivery.count({
      where: { webhookId },
    });

    const rows = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: pagination.take,
      skip: pagination.skip,
    });

    return buildPaginatedResponse(
      rows.map(mapDeliveryRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async sendTestWebhook(orgId: string, webhookId: string): Promise<DeliveryResult> {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, orgId },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    const testPayload = {
      event: 'test',
      orgId,
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook delivery' },
    };

    return this.deliverWebhook(
      webhook.id,
      webhook.url,
      webhook.secret,
      'test',
      testPayload,
    );
  }

  private async deliverWebhook(
    webhookId: string,
    url: string,
    secret: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<DeliveryResult> {
    const body = JSON.stringify(payload);
    const signature = signPayload(body, secret);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let deliveredAt: Date | null = null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Event': event,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      statusCode = response.status;
      responseBody = await response.text().catch(() => null);

      if (response.ok) {
        deliveredAt = new Date();
      }
    } catch (err) {
      responseBody = err instanceof Error ? err.message : 'Unknown delivery error';
    }

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload: payload as object,
        statusCode,
        response: responseBody,
        attempts: 1,
        deliveredAt,
      },
    });

    return mapDeliveryRow(delivery);
  }
}
