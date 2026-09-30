// =============================================================================
// PlayStake — Who may gamble
// =============================================================================
// The single gate in front of every deposit, stake and real-money game. It
// fails closed, and checks in this order:
//
//   1. account status   — suspended or closed accounts cannot gamble
//   2. age / identity   — KYC must be VERIFIED (age verified before any
//                          deposit, free-to-play access or gambling)
//   3. GAMSTOP          — anyone on the national self-exclusion register is
//                          refused; a stale result is re-checked first
//   4. breaks           — cool-off, self-exclusion, and a lapsed
//                          self-exclusion the customer hasn't returned from
//
// Withdrawals are deliberately NOT behind this gate: a self-excluded or
// GAMSTOP-registered customer must still be able to take their money out.
// =============================================================================

import {
  AccountStatus,
  GamstopStatus,
  type KycStatus,
} from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors";
import { assertKycVerified } from "../kyc/policy";
import { getActiveBreak } from "../responsible-play/service";
import { PlayBreakError } from "../responsible-play/errors";
import {
  GAMSTOP_RECHECK_MS,
  GamstopUnavailableError,
  gamstopRequired,
  isGamstopEnabled,
  refreshGamstopStatus,
} from "./gamstop";

export class AccountRestrictedError extends AppError {
  public readonly accountStatus: AccountStatus;

  constructor(accountStatus: AccountStatus) {
    super(
      accountStatus === AccountStatus.SUSPENDED
        ? "Your account is temporarily restricted while we carry out a review. Contact support if you have questions."
        : "This account is closed.",
      403,
      "ACCOUNT_RESTRICTED",
    );
    this.name = "AccountRestrictedError";
    this.accountStatus = accountStatus;
  }
}

export class GamstopExcludedError extends AppError {
  constructor() {
    super(
      "You're registered with GAMSTOP, the national online self-exclusion scheme, so you can't gamble with PlayStake. You can still withdraw your balance.",
      403,
      "GAMSTOP_EXCLUDED",
    );
    this.name = "GamstopExcludedError";
  }
}

export class GamstopCheckFailedError extends AppError {
  constructor() {
    super(
      "We couldn't complete a required self-exclusion check just now. Please try again in a few minutes.",
      503,
      "GAMSTOP_UNAVAILABLE",
    );
    this.name = "GamstopCheckFailedError";
  }
}

interface EligibilityUser {
  accountStatus: AccountStatus;
  kycStatus: KycStatus;
  gamstopStatus: GamstopStatus | null;
  gamstopCheckedAt: Date | null;
}

/** Account status only — also used where gambling isn't involved (withdrawals). */
export function assertAccountUsable(
  user: { accountStatus: AccountStatus },
  { allowClosed = false }: { allowClosed?: boolean } = {},
): void {
  if (user.accountStatus === AccountStatus.ACTIVE) return;
  if (allowClosed && user.accountStatus === AccountStatus.CLOSED) return;
  throw new AccountRestrictedError(user.accountStatus);
}

async function assertNotGamstopExcluded(
  userId: string,
  user: EligibilityUser,
  now: Date,
): Promise<void> {
  if (!isGamstopEnabled()) {
    if (gamstopRequired()) throw new GamstopCheckFailedError();
    return;
  }

  let status = user.gamstopStatus;
  const stale =
    !user.gamstopCheckedAt || now.getTime() - user.gamstopCheckedAt.getTime() > GAMSTOP_RECHECK_MS;
  if (stale) {
    try {
      status = (await refreshGamstopStatus(userId)) ?? status;
    } catch (err) {
      if (err instanceof GamstopUnavailableError) {
        console.error("[GAMSTOP] check failed; refusing to proceed", { userId, err: err.message });
        throw new GamstopCheckFailedError();
      }
      throw err;
    }
  }

  if (status === GamstopStatus.EXCLUDED) throw new GamstopExcludedError();
  // Checking is mandatory: with no result at all we can't let them gamble.
  if (status === null) throw new GamstopCheckFailedError();
}

/**
 * Throw unless this customer may gamble right now. See the file header for
 * what's checked and in which order.
 */
export async function assertEligibleToGamble(
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      accountStatus: true,
      kycStatus: true,
      gamstopStatus: true,
      gamstopCheckedAt: true,
    },
  });

  assertAccountUsable(user);
  assertKycVerified(user);
  await assertNotGamstopExcluded(userId, user, now);

  const activeBreak = await getActiveBreak(userId, now);
  if (activeBreak) throw new PlayBreakError(activeBreak);
}
