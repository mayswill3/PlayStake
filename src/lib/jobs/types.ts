// =============================================================================
// PlayStake — Job Payload Type Definitions
// =============================================================================
// Each background job queue has a typed payload. The "scan" jobs are triggered
// by repeatable schedules and carry no per-item data; workers query the DB
// for actionable items when they receive a scan job.
// =============================================================================

/**
 * Settlement scan: the worker queries the DB for settleable bets.
 * No per-item payload is needed — the scan picks up all qualifying rows.
 */
export interface SettlementScanPayload {
  triggeredAt: string; // ISO timestamp
}

/**
 * Consent-expiry scan.
 */
export interface ConsentExpiryScanPayload {
  triggeredAt: string;
}

/**
 * Bet-expiry scan (OPEN bets past their expiresAt).
 */
export interface BetExpiryScanPayload {
  triggeredAt: string;
}

/**
 * Webhook delivery scan: picks up PENDING / RETRYING deliveries.
 */
export interface WebhookDeliveryScanPayload {
  triggeredAt: string;
}

/**
 * Anomaly detection scan: per-developer pattern analysis.
 */
export interface AnomalyDetectionScanPayload {
  triggeredAt: string;
}

/**
 * Unverified result escalation scan.
 */
export interface UnverifiedResultScanPayload {
  triggeredAt: string;
}

/**
 * Dispute escalation scan.
 */
export interface DisputeEscalationScanPayload {
  triggeredAt: string;
}

/**
 * Ledger audit (daily).
 */
export interface LedgerAuditPayload {
  triggeredAt: string;
}

// ---------------------------------------------------------------------------
// Queue name constants
// ---------------------------------------------------------------------------

export const QUEUE_NAMES = {
  SETTLEMENT: "settlement",
  BET_EXPIRY: "bet-expiry",
  CONSENT_EXPIRY: "consent-expiry",
  WEBHOOK_DELIVERY: "webhook-delivery",
  ANOMALY_DETECTION: "anomaly-detection",
  UNVERIFIED_RESULT: "unverified-result",
  DISPUTE_ESCALATION: "dispute-escalation",
  LEDGER_AUDIT: "ledger-audit",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
