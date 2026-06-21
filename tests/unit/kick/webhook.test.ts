import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as crypto from "crypto";
import { verifyKickSignature } from "../../../src/lib/kick/webhook.js";

// Generate an RSA keypair and point the verifier at our public key via the
// env override, so we can sign payloads exactly as Kick would.
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const MESSAGE_ID = "01J000000000000000000MSGID";
const TIMESTAMP = "2026-06-21T13:00:00Z";
const BODY = JSON.stringify({ is_live: true, broadcaster: { user_id: 42 } });

function sign(messageId: string, timestamp: string, body: string): string {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${messageId}.${timestamp}.${body}`);
  signer.end();
  return signer.sign(privateKey).toString("base64");
}

describe("verifyKickSignature", () => {
  let prevKey: string | undefined;

  beforeAll(() => {
    prevKey = process.env.KICK_WEBHOOK_PUBLIC_KEY;
    process.env.KICK_WEBHOOK_PUBLIC_KEY = publicKey;
  });

  afterAll(() => {
    if (prevKey === undefined) delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    else process.env.KICK_WEBHOOK_PUBLIC_KEY = prevKey;
  });

  it("accepts a correctly signed payload", () => {
    const signature = sign(MESSAGE_ID, TIMESTAMP, BODY);
    expect(verifyKickSignature(MESSAGE_ID, TIMESTAMP, BODY, signature)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signature = sign(MESSAGE_ID, TIMESTAMP, BODY);
    const tampered = BODY.replace("true", "false");
    expect(verifyKickSignature(MESSAGE_ID, TIMESTAMP, tampered, signature)).toBe(false);
  });

  it("rejects when the message id differs from what was signed", () => {
    const signature = sign(MESSAGE_ID, TIMESTAMP, BODY);
    expect(verifyKickSignature("01J000000000000000000OTHER", TIMESTAMP, BODY, signature)).toBe(false);
  });

  it("rejects missing headers", () => {
    const signature = sign(MESSAGE_ID, TIMESTAMP, BODY);
    expect(verifyKickSignature(null, TIMESTAMP, BODY, signature)).toBe(false);
    expect(verifyKickSignature(MESSAGE_ID, null, BODY, signature)).toBe(false);
    expect(verifyKickSignature(MESSAGE_ID, TIMESTAMP, BODY, null)).toBe(false);
  });

  it("rejects a garbage signature without throwing", () => {
    expect(verifyKickSignature(MESSAGE_ID, TIMESTAMP, BODY, "not-base64-@@")).toBe(false);
  });
});
