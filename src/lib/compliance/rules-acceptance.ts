// =============================================================================
// PlayStake — Accepting the Match Rules and the Referee Code of Conduct
// =============================================================================
// A player must have accepted the current Match Rules before sending or
// accepting a stream challenge, and a referee the current Code of Conduct
// before claiming a match. Acceptance is recorded with its version, so a
// disputed match can be judged against the rules the people in it agreed to.
// =============================================================================

import { prisma } from "../db/client";
import { AppError } from "../errors";
import { MATCH_RULES_VERSION, REFEREE_CODE_VERSION } from "../rules";

export class MatchRulesRequiredError extends AppError {
  constructor() {
    super(
      "Please read and accept the Match Rules before playing a stream match.",
      409,
      "MATCH_RULES_REQUIRED",
    );
    this.name = "MatchRulesRequiredError";
  }
}

export class RefereeCodeRequiredError extends AppError {
  constructor() {
    super(
      "Please read and accept the Referee Code of Conduct before officiating.",
      409,
      "REFEREE_CODE_REQUIRED",
    );
    this.name = "RefereeCodeRequiredError";
  }
}

/**
 * Record acceptance when the caller has just ticked the box; otherwise
 * require that the current version was accepted before.
 */
export async function assertMatchRulesAccepted(
  userId: string,
  acceptingNow = false,
): Promise<void> {
  if (acceptingNow) {
    await prisma.user.update({
      where: { id: userId },
      data: { matchRulesVersion: MATCH_RULES_VERSION, matchRulesAcceptedAt: new Date() },
    });
    return;
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { matchRulesVersion: true },
  });
  if (user.matchRulesVersion !== MATCH_RULES_VERSION) throw new MatchRulesRequiredError();
}

export function hasAcceptedMatchRules(user: { matchRulesVersion: string | null }): boolean {
  return user.matchRulesVersion === MATCH_RULES_VERSION;
}

export function hasAcceptedRefereeCode(profile: { codeVersion: string | null }): boolean {
  return profile.codeVersion === REFEREE_CODE_VERSION;
}

/** The data to write when a referee accepts the current Code of Conduct. */
export function refereeCodeAcceptance(now = new Date()) {
  return { codeVersion: REFEREE_CODE_VERSION, codeAcceptedAt: now };
}
