// =============================================================================
// PlayStake — Webhook Dispatch Helper
// =============================================================================
// Creates WebhookDeliveryLog entries and enqueues them for the webhook
// delivery worker to send.
// =============================================================================

import { WebhookEventType } from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { addJob } from "../jobs/queue";
import { QUEUE_NAMES } from "../jobs/types";

/**
 * Dispatch a webhook event to all active WebhookConfig subscribers for
 * the given game that listen to this event type.
 *
 * This function:
 *   1. Looks up active WebhookConfig records for the game that include
 *      the specified eventType in their `events` array.
 *   2. Creates a WebhookDeliveryLog entry with status = PENDING for each.
 *   3. Enqueues a webhook-delivery scan job so the worker picks them up
 *      promptly (in addition to the regular polling schedule).
 *
 * @param eventType  The webhook event type (e.g., BET_SETTLED).
 * @param gameId     The game ID that originated the event.
 * @param betId      The bet ID associated with the event (if applicable).
 * @param payload    The event payload to deliver.
 */
export async function dispatchWebhook(
  eventType: WebhookEventType,
  gameId: string,
  betId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    // Find all active webhook configs for this game that subscribe to this event
    const configs = await prisma.webhookConfig.findMany({
      where: {
        gameId,
        isActive: true,
        events: { has: eventType },
      },
    });

    if (configs.length === 0) {
      return; // No subscribers, nothing to do
    }

    // Create delivery log entries for each config
    const deliveryLogs = await Promise.all(
      configs.map((config) =>
        prisma.webhookDeliveryLog.create({
          data: {
            webhookConfigId: config.id,
            betId,
            eventType,
            payload: {
              event: eventType,
              betId,
              gameId,
              timestamp: new Date().toISOString(),
              data: payload,
            },
            status: "PENDING",
            attemptCount: 0,
          },
        })
      )
    );

    // Enqueue an immediate scan so the worker picks these up fast
    await addJob(
      QUEUE_NAMES.WEBHOOK_DELIVERY,
      "webhook-delivery-scan",
      { triggeredAt: new Date().toISOString() },
      { jobId: `webhook-dispatch-${Date.now()}` }
    );

    console.log(
      JSON.stringify({
        level: "info",
        msg: "webhook_dispatched",
        eventType,
        gameId,
        betId,
        deliveryCount: deliveryLogs.length,
      })
    );
  } catch (error) {
    // Webhook dispatch failures should never block the main operation.
    // Log the error and continue.
    console.error(
      JSON.stringify({
        level: "error",
        msg: "webhook_dispatch_failed",
        eventType,
        gameId,
        betId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
