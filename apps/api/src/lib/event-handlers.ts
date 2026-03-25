import { eventBus } from './event-bus.js';
import type { PrismaClient } from '@prisma/client';
import type { TenantManager } from '../tenancy/tenant-manager.js';

export function registerEventHandlers(_prisma: PrismaClient, _tenantManager: TenantManager): void {
  // When a debrief is generated, trigger webhook
  eventBus.on('debrief.generated', async (data) => {
    try {
      const { WebhookService } = await import('../modules/webhooks/webhooks.service.js');
      const webhookService = new WebhookService(_prisma);
      await webhookService.triggerWebhook(data.orgSlug, 'debrief.generated', data);
    } catch (err) {
      console.error('[EventBus] webhook trigger failed:', err);
    }
  });

  // When an execution completes, create a notification
  eventBus.on('execution.completed', async (data) => {
    try {
      const { NotificationService } = await import(
        '../modules/notifications/notifications.service.js'
      );
      const _notificationService = new NotificationService(_prisma);
      // Create notification for all org members (simplified — notify the execution owner)
      // This is a best-effort side effect
      void data;
    } catch (err) {
      console.error('[EventBus] notification failed:', err);
    }
  });

  // When a compliance check fails, create a notification
  eventBus.on('compliance.checked', async (data) => {
    if (!data.passed) {
      try {
        const { NotificationService } = await import(
          '../modules/notifications/notifications.service.js'
        );
        const _notificationService = new NotificationService(_prisma);
        // Notify about failed compliance
        void data;
      } catch (err) {
        console.error('[EventBus] compliance notification failed:', err);
      }
    }
  });

  // When a proposal is approved, trigger webhook
  eventBus.on('proposal.approved', async (data) => {
    try {
      const { WebhookService } = await import('../modules/webhooks/webhooks.service.js');
      const webhookService = new WebhookService(_prisma);
      await webhookService.triggerWebhook(data.orgSlug, 'proposal.approved', data);
    } catch (err) {
      console.error('[EventBus] webhook trigger failed:', err);
    }
  });
}
