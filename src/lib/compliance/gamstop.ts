// =============================================================================
// PlayStake — GAMSTOP (national multi-operator self-exclusion)
// =============================================================================
// Every GB-facing remote operator must check customers against GAMSTOP and
// refuse gambling to anyone registered. The check needs the customer's
// identity, so it runs once that is known (KYC submission), on each login,
// and again whenever the cached result goes stale before a deposit or bet.
//
// Switched on by GAMSTOP_API_KEY. Without it the check is skipped (local dev
// and until PlayStake is onboarded); `gamstopRequired()` makes production
// refuse to run gambling with it off. Field names and the X-Exclusion header
// follow GAMSTOP's operator API — confirm against their current spec during
// onboarding.
// =============================================================================

import { GamstopStatus, KycSubmissionStatus } from "../../../generated/prisma/client";
import { prisma } from "../db/client";

/** A result older than this is re-checked before the next deposit or bet. */
export const GAMSTOP_RECHECK_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

export function isGamstopEnabled(): boolean {
  return Boolean(process.env.GAMSTOP_API_KEY);
}

/**
 * Whether gambling must be refused while the check is switched off. On for
 * real-money operation (GAMSTOP_REQUIRED=true), off for local development and
 * the unlicensed test-mode deployment.
 */
export function gamstopRequired(): boolean {
  return process.env.GAMSTOP_REQUIRED === "true";
}

export interface GamstopSubject {
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  email: string;
  postcode: string;
  mobile?: string | null;
}

export class GamstopUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GamstopUnavailableError";
  }
}

/** Ask GAMSTOP whether this person is self-excluded. Throws if it can't tell. */
export async function queryGamstop(subject: GamstopSubject): Promise<GamstopStatus> {
  const apiKey = process.env.GAMSTOP_API_KEY;
  if (!apiKey) throw new GamstopUnavailableError("GAMSTOP is not configured");

  const body = new URLSearchParams({
    firstName: subject.firstName,
    lastName: subject.lastName,
    dateOfBirth: subject.dateOfBirth,
    email: subject.email,
    postcode: subject.postcode,
    mobile: subject.mobile ?? "",
  });

  let response: Response;
  try {
    response = await fetch(process.env.GAMSTOP_API_URL ?? "https://api.gamstop.io/v2", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new GamstopUnavailableError(
      `GAMSTOP request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    throw new GamstopUnavailableError(`GAMSTOP responded ${response.status}`);
  }

  switch (response.headers.get("X-Exclusion")?.toUpperCase()) {
    case "Y":
      return GamstopStatus.EXCLUDED;
    case "P":
      return GamstopStatus.PREVIOUSLY_EXCLUDED;
    case "N":
      return GamstopStatus.NOT_EXCLUDED;
    default:
      throw new GamstopUnavailableError("GAMSTOP response had no exclusion result");
  }
}

/**
 * Look the customer up using their identity from the latest KYC submission
 * and store the result. Returns null when there's nothing to check with yet
 * (no KYC) or the check is switched off.
 */
export async function refreshGamstopStatus(userId: string): Promise<GamstopStatus | null> {
  if (!isGamstopEnabled()) return null;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      kycSubmissions: {
        where: { status: { in: [KycSubmissionStatus.APPROVED, KycSubmissionStatus.PENDING] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          legalFirstName: true,
          legalLastName: true,
          dateOfBirth: true,
          postalCode: true,
        },
      },
    },
  });
  const identity = user.kycSubmissions[0];
  if (!identity) return null;

  const status = await queryGamstop({
    firstName: identity.legalFirstName,
    lastName: identity.legalLastName,
    dateOfBirth: identity.dateOfBirth.toISOString().slice(0, 10),
    email: user.email,
    postcode: identity.postalCode,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { gamstopStatus: status, gamstopCheckedAt: new Date() },
  });
  return status;
}

/** Refresh without letting a GAMSTOP outage break the caller (e.g. login). */
export async function refreshGamstopStatusQuietly(userId: string): Promise<void> {
  try {
    await refreshGamstopStatus(userId);
  } catch (err) {
    console.error("[GAMSTOP] status refresh failed", {
      userId,
      err: err instanceof Error ? err.message : err,
    });
  }
}
