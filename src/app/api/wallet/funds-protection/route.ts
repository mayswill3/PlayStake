import { withSessionAuth } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { errorResponse } from "@/lib/errors";
import { LedgerAccountType } from "../../../../../generated/prisma/client";
import { dollarsToCents } from "@/lib/utils/money";
import {
  FUNDS_PROTECTION_EXPLAINER,
  FUNDS_PROTECTION_LEVEL,
  FUNDS_PROTECTION_LEVEL_LABEL,
  fundsProtectionReason,
  hasDeposited,
  FUNDS_PROTECTION_STATEMENT,
  FUNDS_PROTECTION_VERSION,
  acknowledgeFundsProtection,
  hasAcknowledgedFundsProtection,
} from "@/lib/compliance/funds-protection";

const disclosure = {
  level: FUNDS_PROTECTION_LEVEL,
  levelLabel: FUNDS_PROTECTION_LEVEL_LABEL,
  version: FUNDS_PROTECTION_VERSION,
  statement: FUNDS_PROTECTION_STATEMENT,
  explainer: FUNDS_PROTECTION_EXPLAINER,
};

/**
 * GET /api/wallet/funds-protection — the disclosure, whether it's currently
 * acknowledged, why it's being asked, and the funds held for the customer
 * (the six-monthly reminder must state them).
 */
export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    const [user, account, deposited] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: auth.userId },
        select: { fundsProtectionVersion: true, fundsProtectionAcknowledgedAt: true },
      }),
      prisma.ledgerAccount.findUnique({
        where: { userId_accountType: { userId: auth.userId, accountType: LedgerAccountType.PLAYER_BALANCE } },
        select: { balance: true },
      }),
      hasDeposited(auth.userId),
    ]);
    return Response.json({
      ...disclosure,
      acknowledged: hasAcknowledgedFundsProtection(user),
      acknowledgedAt: user.fundsProtectionAcknowledgedAt,
      reason: fundsProtectionReason(user),
      hasDeposited: deposited,
      balanceCents: account ? dollarsToCents(account.balance) : 0,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

/** POST /api/wallet/funds-protection — "I have read and understood how my funds are protected." */
export const POST = withSessionAuth(async (_request, _context, auth) => {
  try {
    const saved = await acknowledgeFundsProtection(auth.userId);
    return Response.json({ ...disclosure, acknowledged: true, acknowledgedAt: saved.fundsProtectionAcknowledgedAt });
  } catch (error) {
    return errorResponse(error);
  }
});
