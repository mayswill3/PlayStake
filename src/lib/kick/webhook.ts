import * as crypto from "crypto";

/**
 * Kick webhook signature verification.
 *
 * Kick signs every webhook with an RSA private key. We verify against the
 * corresponding public key using RSA-SHA256 (PKCS#1 v1.5 padding).
 *
 * The signed message is the concatenation, joined by ".", of:
 *   Kick-Event-Message-Id . Kick-Event-Message-Timestamp . <raw request body>
 *
 * The signature itself arrives base64-encoded in the Kick-Event-Signature header.
 *
 * Docs: https://docs.kick.com/events/webhook-security
 */

// Header names sent on every Kick webhook delivery.
export const KICK_HEADERS = {
  messageId: "kick-event-message-id",
  subscriptionId: "kick-event-subscription-id",
  signature: "kick-event-signature",
  timestamp: "kick-event-message-timestamp",
  eventType: "kick-event-type",
  eventVersion: "kick-event-version",
} as const;

// Kick's public key (PEM). Can be overridden via env for rotation; otherwise
// falls back to the published production key. Also retrievable at runtime from
// https://api.kick.com/public/v1/public-key.
const DEFAULT_KICK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

function getPublicKey(): string {
  const override = process.env.KICK_WEBHOOK_PUBLIC_KEY;
  // Support keys passed with escaped newlines (common in env config).
  return override ? override.replace(/\\n/g, "\n") : DEFAULT_KICK_PUBLIC_KEY;
}

/**
 * Verify a Kick webhook signature.
 *
 * @param messageId  value of the Kick-Event-Message-Id header
 * @param timestamp  value of the Kick-Event-Message-Timestamp header
 * @param rawBody    the exact, unparsed request body bytes
 * @param signature  base64 value of the Kick-Event-Signature header
 */
export function verifyKickSignature(
  messageId: string | null,
  timestamp: string | null,
  rawBody: string,
  signature: string | null,
): boolean {
  if (!messageId || !timestamp || !signature) {
    return false;
  }

  const signedMessage = `${messageId}.${timestamp}.${rawBody}`;

  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(signature, "base64");
  } catch {
    return false;
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signedMessage);
  verifier.end();

  try {
    return verifier.verify(getPublicKey(), signatureBytes);
  } catch {
    // Malformed key or signature buffer — treat as not verified.
    return false;
  }
}
