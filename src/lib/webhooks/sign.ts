// =============================================================================
// PlayStake — Webhook Signature Utilities
// =============================================================================
// HMAC-SHA256 signing for outbound webhook payloads sent to game developers.
// =============================================================================

import * as crypto from "crypto";

/**
 * Compute an HMAC-SHA256 hex digest for a webhook payload.
 *
 * @param secret    The webhook secret (from WebhookConfig.secret).
 * @param timestamp Unix epoch seconds when the payload was prepared.
 * @param payload   Stringified JSON payload body.
 * @returns Hex-encoded HMAC-SHA256 signature.
 */
export function signWebhookPayload(
  secret: string,
  timestamp: number,
  payload: string
): string {
  const signedContent = `${timestamp}.${payload}`;
  return crypto
    .createHmac("sha256", secret)
    .update(signedContent)
    .digest("hex");
}

/**
 * Build the full X-PlayStake-Signature header value.
 *
 * Format: `t=<unix_timestamp>,v1=<hex_signature>`
 *
 * @param secret  The webhook secret.
 * @param payload Stringified JSON payload body.
 * @returns The complete header value.
 */
export function buildSignatureHeader(
  secret: string,
  payload: string
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload(secret, timestamp, payload);
  return `t=${timestamp},v1=${signature}`;
}
