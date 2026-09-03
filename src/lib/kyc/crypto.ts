import * as crypto from "crypto";

// Identity documents are the most sensitive bytes PlayStake holds. They live in
// Postgres encrypted with AES-256-GCM under a key that is deliberately separate
// from KICK_TOKEN_ENCRYPTION_KEY, so a leak of one does not expose the other.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export interface EncryptedBlob {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

function getKey(): Buffer {
  const raw = process.env.KYC_DOCUMENT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "KYC_DOCUMENT_ENCRYPTION_KEY environment variable is not set",
    );
  }

  // Accept either hex (64 chars) or base64 encoded 32-byte keys.
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `KYC_DOCUMENT_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length})`,
    );
  }
  return key;
}

/** Encrypt document bytes for storage. */
export function encryptDocument(plaintext: Buffer): EncryptedBlob {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

/**
 * Decrypt document bytes.
 *
 * Throws if the ciphertext was tampered with (GCM auth tag check fails).
 */
export function decryptDocument(blob: EncryptedBlob): Buffer {
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, blob.iv);
  decipher.setAuthTag(blob.authTag);

  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
}

/** Content hash, stored alongside the ciphertext to detect silent corruption. */
export function hashDocument(plaintext: Buffer): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}
