// =============================================================================
// PlayStake — Usernames
// =============================================================================
// Display names aren't unique, so search and profile links use a username:
// 3–20 lowercase letters, digits or underscores. Every account gets one at
// sign-up, made from the display name; people can change it once every 30
// days so a handle can't be swapped about to dodge a block or a report.
// =============================================================================

import { randomBytes } from "crypto";
import { prisma, type TxClient } from "../db/client";
import { ConflictError, ValidationError } from "../errors";

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const USERNAME_CHANGE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

const RESERVED = new Set([
  "admin", "administrator", "support", "playstake", "staff", "moderator", "mod",
  "help", "root", "system", "referee", "official", "player", "me", "settings",
]);

/** Lowercase and drop a leading @, so "@Kwasi88" and "kwasi88" match. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function validateUsername(raw: string): string {
  const username = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(username)) {
    throw new ValidationError("Usernames are 3–20 characters: letters, numbers and underscores only.");
  }
  if (RESERVED.has(username)) throw new ValidationError("That username isn't available.");
  return username;
}

function baseFromDisplayName(displayName: string): string {
  const base = displayName.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 14);
  return base.length >= 3 && !RESERVED.has(base) ? base : "player";
}

/** A free username based on the display name, for a new account. */
export async function generateUsername(db: TxClient | typeof prisma, displayName: string): Promise<string> {
  const base = baseFromDisplayName(displayName);
  const candidates = [base, ...Array.from({ length: 5 }, () => `${base}_${randomBytes(3).toString("hex").slice(0, 5)}`)];
  for (const candidate of candidates) {
    if (candidate === "player") continue;
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `player_${randomBytes(4).toString("hex").slice(0, 8)}`;
}

/** When this user may next change their username, or null if they can now. */
export function nextUsernameChangeAt(changedAt: Date | null, now: Date = new Date()): Date | null {
  if (!changedAt) return null;
  const next = new Date(changedAt.getTime() + USERNAME_CHANGE_INTERVAL_MS);
  return next > now ? next : null;
}

export async function changeUsername(userId: string, raw: string, now: Date = new Date()): Promise<string> {
  const username = validateUsername(raw);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { username: true, usernameChangedAt: true },
  });
  if (user.username === username) return username;

  const next = nextUsernameChangeAt(user.usernameChangedAt, now);
  if (next) {
    throw new ConflictError(
      `You can change your username again on ${next.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`,
    );
  }
  const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (taken) throw new ConflictError("That username is taken.");

  try {
    await prisma.user.update({ where: { id: userId }, data: { username, usernameChangedAt: now } });
  } catch {
    // Lost a race for the same name.
    throw new ConflictError("That username is taken.");
  }
  return username;
}
