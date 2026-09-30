// =============================================================================
// PlayStake — Account restrictions and closures (staff actions)
// =============================================================================
// Suspend (AML/fraud/affordability review), reinstate, close, and close as
// under-18. Every change is written to the admin audit log with the reason.
//
// Closing an account as under-18 also voids every bet of theirs that hasn't
// settled, refunding both stakes. Their balance is then returned to them
// outside the platform, and any winnings from settled bets are reviewed by
// compliance — see the Age Verification Policy.
// =============================================================================

import {
  AccountStatus,
  BetStatus,
  LedgerAccountType,
  RefereeAssignmentStatus,
} from "../../../generated/prisma/client";
import { prisma, withTransaction, type TxClient } from "../db/client";
import { ConflictError, ValidationError } from "../errors";
import { refundEscrow } from "../ledger/escrow";
import { withdrawOpenActivity } from "../responsible-play/service";
import { destroyAllUserSessions } from "../auth/session";
import { recordAdminAction } from "../admin/audit";

const UNSETTLED_STATUSES: BetStatus[] = [BetStatus.MATCHED, BetStatus.RESULT_REPORTED, BetStatus.DISPUTED];

export interface SetAccountStatusInput {
  actorId: string;
  userId: string;
  status: AccountStatus;
  reason: string;
  request?: Request | null;
}

export interface SetAccountStatusResult {
  status: AccountStatus;
  voidedBetIds: string[];
  /** Player balance at closure — returned to the customer off-platform. */
  balanceAtClosure: string | null;
}

export async function setAccountStatus(
  input: SetAccountStatusInput,
): Promise<SetAccountStatusResult> {
  const reason = input.reason.trim();
  if (reason.length < 10) {
    throw new ValidationError("Give a reason of at least 10 characters");
  }
  if (input.actorId === input.userId) {
    throw new ConflictError("You can't change the status of your own account");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { accountStatus: true },
  });
  if (user.accountStatus === AccountStatus.CLOSED_UNDERAGE && input.status !== AccountStatus.CLOSED_UNDERAGE) {
    // Reopening an under-18 closure would need a fresh, verified identity —
    // i.e. a new account once they are old enough, not a status flip.
    throw new ConflictError("An account closed as under-18 cannot be reopened");
  }

  const voidedBetIds =
    input.status === AccountStatus.CLOSED_UNDERAGE ? await voidUnsettledBets(input.userId) : [];

  const balanceAtClosure = await withTransaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        accountStatus: input.status,
        accountStatusReason: reason,
        accountStatusChangedAt: new Date(),
      },
    });

    const balance =
      input.status === AccountStatus.ACTIVE
        ? null
        : (
            await tx.ledgerAccount.findUnique({
              where: {
                userId_accountType: {
                  userId: input.userId,
                  accountType: LedgerAccountType.PLAYER_BALANCE,
                },
              },
              select: { balance: true },
            })
          )?.balance.toString() ?? "0";

    await recordAdminAction(
      {
        actorId: input.actorId,
        action: "user.account_status",
        targetType: "user",
        targetId: input.userId,
        details: {
          from: user.accountStatus,
          to: input.status,
          reason,
          voidedBetIds,
          balanceAtChange: balance,
        },
        request: input.request,
      },
      tx,
    );
    return balance;
  });

  if (input.status !== AccountStatus.ACTIVE) {
    await withdrawOpenActivity(input.userId);
  }
  if (input.status === AccountStatus.CLOSED || input.status === AccountStatus.CLOSED_UNDERAGE) {
    await destroyAllUserSessions(input.userId);
  }

  return { status: input.status, voidedBetIds, balanceAtClosure };
}

/**
 * Void every unsettled bet this customer is party to and refund both stakes:
 * an under-18 cannot lawfully win or lose a bet.
 */
async function voidUnsettledBets(userId: string): Promise<string[]> {
  const bets = await prisma.bet.findMany({
    where: {
      status: { in: UNSETTLED_STATUSES },
      OR: [{ playerAId: userId }, { playerBId: userId }],
    },
    select: { id: true },
  });

  const voided: string[] = [];
  for (const { id } of bets) {
    const done = await withTransaction((tx) => voidBetAndRefund(tx, id, "underage"));
    if (done) voided.push(id);
  }
  return voided;
}

/**
 * Void an unsettled bet and return each player's stake. Returns false if the
 * bet settled or was voided in the meantime.
 */
export async function voidBetAndRefund(tx: TxClient, betId: string, reason: string): Promise<boolean> {
  await tx.$queryRaw`SELECT id FROM bets WHERE id = ${betId}::uuid FOR UPDATE`;
  const bet = await tx.bet.findUniqueOrThrow({
    where: { id: betId },
    select: { id: true, status: true, amount: true, playerAId: true, playerBId: true },
  });
  if (!UNSETTLED_STATUSES.includes(bet.status)) return false;

  await tx.bet.update({
    where: { id: bet.id },
    data: { status: BetStatus.VOIDED, cancelledAt: new Date() },
  });
  await tx.refereeAssignment.updateMany({
    where: {
      betId: bet.id,
      status: {
        notIn: [RefereeAssignmentStatus.COMPLETED, RefereeAssignmentStatus.CANCELLED],
      },
    },
    data: { status: RefereeAssignmentStatus.CANCELLED, cancelledAt: new Date() },
  });

  const escrow = await tx.ledgerAccount.findFirst({
    where: { betId: bet.id, accountType: LedgerAccountType.ESCROW },
    select: { id: true },
  });
  if (!escrow) return true;

  for (const [side, playerId] of [
    ["a", bet.playerAId],
    ["b", bet.playerBId],
  ] as const) {
    if (!playerId) continue;
    await refundEscrow(tx, {
      betId: bet.id,
      playerId,
      amount: bet.amount,
      idempotencyKey: `void-${reason}-${side}-${bet.id}`,
    });
  }
  return true;
}
