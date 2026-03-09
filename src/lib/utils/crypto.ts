import * as crypto from "crypto";

// Base62 character set: digits + uppercase + lowercase
const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Generate a cryptographically secure random token encoded in base62.
 *
 * @param length Number of random bytes to use as entropy source.
 *               The resulting string will be longer than `length` due to base62 encoding.
 */
export function generateRandomToken(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += BASE62_CHARS[bytes[i] % 62];
  }
  return result;
}

/**
 * Compute SHA-256 hex digest of a string.
 */
export function sha256Hash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Returns false if the strings differ in length (but still takes
 * roughly constant time relative to the shorter string).
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against self so we still spend time, but always return false.
    const dummy = Buffer.from(a);
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
