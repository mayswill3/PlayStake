// =============================================================================
// PlayStake — Customer funds held (LCCP 4.1.1)
// =============================================================================
// What PlayStake owes customers right now: every player balance plus every
// stake held in a match. Finance reconciles this figure daily against the
// customer-funds (client) bank account and the money held with Stripe, and
// tops up any shortfall from company funds the same day (Policy 19 §4).
// =============================================================================

import { LedgerAccountType } from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { dollarsToCents } from "../utils/money";

export interface CustomerFundsHeld {
  playerBalancesCents: number;
  heldInMatchesCents: number;
  totalCents: number;
  asAt: string;
}

export async function getCustomerFundsHeld(now: Date = new Date()): Promise<CustomerFundsHeld> {
  const [players, escrow] = await Promise.all([
    prisma.ledgerAccount.aggregate({ where: { accountType: LedgerAccountType.PLAYER_BALANCE }, _sum: { balance: true } }),
    prisma.ledgerAccount.aggregate({ where: { accountType: LedgerAccountType.ESCROW }, _sum: { balance: true } }),
  ]);
  const playerBalancesCents = players._sum.balance ? dollarsToCents(players._sum.balance) : 0;
  const heldInMatchesCents = escrow._sum.balance ? dollarsToCents(escrow._sum.balance) : 0;
  return { playerBalancesCents, heldInMatchesCents, totalCents: playerBalancesCents + heldInMatchesCents, asAt: now.toISOString() };
}
