// =============================================================================
// PlayStake — Recorder access to the recording view
// =============================================================================
// The recording view shows a match's streams and events without a login, so
// it needs its own proof: an HMAC over the bet id and an expiry, signed with
// RECORDER_SECRET. Only the recorder service holds the secret.
// =============================================================================

import { createHmac, timingSafeEqual } from "crypto";

const sign = (payload: string) =>
  createHmac("sha256", process.env.RECORDER_SECRET ?? "").update(payload).digest("base64url");

export function signRecorderToken(betId: string, ttlMs: number, now: number = Date.now()): string {
  const exp = Math.floor((now + ttlMs) / 1000);
  const payload = `${betId}.${exp}`;
  return `${exp}.${sign(payload)}`;
}

export function verifyRecorderToken(betId: string, token: string | null | undefined, now: number = Date.now()): boolean {
  if (!process.env.RECORDER_SECRET || !token) return false;
  const [expRaw, signature] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !signature || exp * 1000 < now) return false;
  const expected = Buffer.from(sign(`${betId}.${exp}`));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
