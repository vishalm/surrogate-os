import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../lib/errors.js';
import { buildPaginatedResponse, type PaginationParams } from '../../lib/pagination.js';
import type { PaginatedResponse } from '@surrogate-os/shared';

interface NotificationResult {
  id: string;
  orgId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
}

function mapNotificationRow(row: {
  id: string;
  orgId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
}): NotificationResult {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    metadata: row.metadata,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export class NotificationService {
  constructor(private readonly prisma: PrismaClient) {}

  async createNotification(
    orgId: string,
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<NotificationResult> {
    const row = await this.prisma.notification.create({
      data: {
        orgId,
        userId,
        type,
        title,
        message,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });

    return mapNotificationRow(row);
  }

  async listNotifications(
    userId: string,
    pagination: PaginationParams,
    unreadOnly = false,
  ): Promise<PaginatedResponse<NotificationResult>> {
    const where = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const total = await this.prisma.notification.count({ where });

    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pagination.take,
      skip: pagination.skip,
    });

    return buildPaginatedResponse(
      rows.map(mapNotificationRow),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async markAsRead(userId: string, notificationId: string): Promise<NotificationResult> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return mapNotificationRow(updated);
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { count: result.count };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }
}
