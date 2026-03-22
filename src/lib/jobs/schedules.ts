// =============================================================================
// PlayStake — Repeatable Job Schedules
// =============================================================================
// Registers BullMQ repeatable jobs that fire "scan" payloads at fixed
// intervals. Each scan triggers the corresponding worker to query the DB
// for actionable items.
// =============================================================================

import { getQueue } from "./queue";
import { QUEUE_NAMES, type QueueName } from "./types";
import type {
  SettlementScanPayload,
  ConsentExpiryScanPayload,
  BetExpiryScanPayload,
  WebhookDeliveryScanPayload,
  AnomalyDetectionScanPayload,
  UnverifiedResultScanPayload,
  DisputeEscalationScanPayload,
  LedgerAuditPayload,
} from "./types";

// ---------------------------------------------------------------------------
// Schedule definitions
// ---------------------------------------------------------------------------

interface ScheduleEntry {
  queueName: QueueName;
  jobName: string;
  pattern?: string;   // cron pattern (for daily jobs)
  every?: number;     // interval in milliseconds (for frequent jobs)
}

const SCHEDULES: ScheduleEntry[] = [
  {
    queueName: QUEUE_NAMES.SETTLEMENT,
    jobName: "settlement-scan",
    every: 30_000, // every 30 seconds
  },
  {
    queueName: QUEUE_NAMES.CONSENT_EXPIRY,
    jobName: "consent-expiry-scan",
    every: 15_000, // every 15 seconds
  },
  {
    queueName: QUEUE_NAMES.BET_EXPIRY,
    jobName: "bet-expiry-scan",
    every: 60_000, // every 60 seconds
  },
  {
    queueName: QUEUE_NAMES.UNVERIFIED_RESULT,
    jobName: "unverified-result-scan",
    every: 60_000, // every 60 seconds
  },
  {
    queueName: QUEUE_NAMES.WEBHOOK_DELIVERY,
    jobName: "webhook-delivery-scan",
    every: 10_000, // every 10 seconds (webhooks should be fast)
  },
  {
    queueName: QUEUE_NAMES.ANOMALY_DETECTION,
    jobName: "anomaly-detection-scan",
    every: 15 * 60_000, // every 15 minutes
  },
  {
    queueName: QUEUE_NAMES.DISPUTE_ESCALATION,
    jobName: "dispute-escalation-scan",
    every: 5 * 60_000, // every 5 minutes
  },
  {
    queueName: QUEUE_NAMES.LEDGER_AUDIT,
    jobName: "ledger-audit",
    pattern: "0 3 * * *", // daily at 03:00 UTC
  },
];

// ---------------------------------------------------------------------------
// Registration function
// ---------------------------------------------------------------------------

export async function registerSchedules(): Promise<void> {
  for (const schedule of SCHEDULES) {
    const queue = getQueue(schedule.queueName);

    const repeatOpts = schedule.pattern
      ? { pattern: schedule.pattern }
      : { every: schedule.every! };

    await queue.upsertJobScheduler(
      schedule.jobName,
      repeatOpts,
      {
        name: schedule.jobName,
        data: { triggeredAt: new Date().toISOString() },
      }
    );

    console.log(
      JSON.stringify({
        level: "info",
        msg: "registered_schedule",
        queue: schedule.queueName,
        job: schedule.jobName,
        ...(schedule.pattern
          ? { cron: schedule.pattern }
          : { everyMs: schedule.every }),
      })
    );
  }
}
