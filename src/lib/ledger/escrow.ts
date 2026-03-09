import { Decimal } from "@prisma/client/runtime/client";
import {
  TransactionType,
  LedgerAccountType,
  BetStatus,
} from "../../../generated/prisma/client.js";
import type { TxClient } from "../db/client.js";
import {
  getOrCreatePlayerAccount,
  createEscrowAccount,
  getEscrowAccountForBet,
  getSystemAccount,
  getOrCreateDeveloperAccount,
  getAccountBalance,
} from "./accounts.js";
import { transfer, type TransferResult } from "./transfer.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HoldEscrowInput {
  playerId: string;
  betId: string;
  amount: Decimal | string | number;
  idempotencyKey: string;
}

export interface ReleaseEscrowInput {
  betId: string;
  winnerId: string;
  amount: Decimal | string | number;
  idempotencyKey: string;
}

export interface RefundEscrowInput {
  betId: string;
  playerId: string;
  amount: Decimal | string | number;
  idempotencyKey: string;
}

export interface CollectFeeInput {
  betId: string;
  feeAmount: Decimal | string | number;
  idempotencyKey: string;
}

export interface DistributeDevShareInput {
  developerUserId: string;
  amount: Decimal | string | number;
  idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Escrow errors
// ---------------------------------------------------------------------------

export class EscrowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EscrowError";
  }
}

// ---------------------------------------------------------------------------
// holdEscrow
// ---------------------------------------------------------------------------

/**
 * Move funds from a player's balance to a bet's escrow account.
 *
 * Steps:
 *   1. Get or create the player's PLAYER_BALANCE account.
 *   2. Create the escrow account for the bet (if it doesn't exist).
 *   3. Execute the double-entry transfer (player -> escrow).
 *   4. Update the DeveloperEscrowLimit.currentEscrow for the game's developer.
 *
 * This function should be called when a player consents to a bet or accepts a bet.
 */
export async function holdEscrow(
  tx: TxClient,
  input: HoldEscrowInput
): Promise<TransferResult> {
  const amount = new Decimal(input.amount.toString());

  if (amount.lte(0)) {
    throw new EscrowError("Escrow amount must be positive");
  }

  // Get the bet to find the game and developer
  const bet = await tx.bet.findUniqueOrThrow({
    where: { id: input.betId },
    include: {
      game: {
        include: {
          developerProfile: {
            include: { escrowLimit: true },
          },
        },
      },
    },
  });

  // Validate bet is in the right state for escrow hold
  if (
    bet.status !== BetStatus.PENDING_CONSENT &&
    bet.status !== BetStatus.OPEN
  ) {
    throw new EscrowError(
      `Cannot hold escrow for bet ${input.betId}: bet is in ${bet.status} status, expected PENDING_CONSENT or OPEN`
    );
  }

  // Get player account and escrow account
  const playerAccount = await getOrCreatePlayerAccount(tx, input.playerId);
  const escrowAccount = await createEscrowAccount(tx, input.betId);

  // Execute the double-entry transfer
  const result = await transfer(tx, {
    fromAccountId: playerAccount.id,
    toAccountId: escrowAccount.id,
    amount,
    transactionType: TransactionType.BET_ESCROW,
    description: `Escrow hold for bet ${input.betId}`,
    betId: input.betId,
    idempotencyKey: input.idempotencyKey,
  });

  // Atomically update developer escrow limit
  // Uses UPDATE ... WHERE to enforce the cap atomically
  const escrowLimit = bet.game.developerProfile.escrowLimit;
  if (escrowLimit) {
    const updated: { current_escrow: Decimal }[] = await tx.$queryRaw`
      UPDATE developer_escrow_limits
      SET current_escrow = current_escrow + ${amount}::decimal,
          updated_at = NOW()
      WHERE id = ${escrowLimit.id}::uuid
        AND current_escrow + ${amount}::decimal <= max_total_escrow
        AND ${amount}::decimal <= max_single_bet
      RETURNING current_escrow
    `;

    if (updated.length === 0) {
      throw new EscrowError(
        `Developer escrow cap exceeded for developer profile ${bet.game.developerProfileId}`
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// releaseEscrow
// ---------------------------------------------------------------------------

/**
 * Move funds from escrow to the winner's player balance.
 *
 * This is called during settlement after the result is verified.
 */
export async function releaseEscrow(
  tx: TxClient,
  input: ReleaseEscrowInput
): Promise<TransferResult> {
  const amount = new Decimal(input.amount.toString());

  if (amount.lte(0)) {
    throw new EscrowError("Release amount must be positive");
  }

  // Get the bet to validate state
  const bet = await tx.bet.findUniqueOrThrow({
    where: { id: input.betId },
  });

  // Release is valid during settlement (RESULT_REPORTED) or dispute resolution
  if (
    bet.status !== BetStatus.RESULT_REPORTED &&
    bet.status !== BetStatus.DISPUTED &&
    bet.status !== BetStatus.SETTLED // Allow re-entry for idempotency
  ) {
    throw new EscrowError(
      `Cannot release escrow for bet ${input.betId}: bet is in ${bet.status} status`
    );
  }

  const escrowAccount = await getEscrowAccountForBet(tx, input.betId);
  const escrowBalance = await getAccountBalance(tx, escrowAccount.id);

  if (escrowBalance.lt(amount)) {
    throw new EscrowError(
      `Escrow account for bet ${input.betId} has insufficient balance: ${escrowBalance}, requested ${amount}`
    );
  }

  const winnerAccount = await getOrCreatePlayerAccount(tx, input.winnerId);

  return transfer(tx, {
    fromAccountId: escrowAccount.id,
    toAccountId: winnerAccount.id,
    amount,
    transactionType: TransactionType.BET_ESCROW_RELEASE,
    description: `Escrow release for bet ${input.betId} to winner`,
    betId: input.betId,
    idempotencyKey: input.idempotencyKey,
  });
}

// ---------------------------------------------------------------------------
// refundEscrow
// ---------------------------------------------------------------------------

/**
 * Refund funds from escrow back to a player.
 *
 * Used when a bet is cancelled (player A refunded if only they escrowed,
 * both players refunded if matched and voided).
 */
export async function refundEscrow(
  tx: TxClient,
  input: RefundEscrowInput
): Promise<TransferResult> {
  const amount = new Decimal(input.amount.toString());

  if (amount.lte(0)) {
    throw new EscrowError("Refund amount must be positive");
  }

  const bet = await tx.bet.findUniqueOrThrow({
    where: { id: input.betId },
    include: {
      game: {
        include: {
          developerProfile: {
            include: { escrowLimit: true },
          },
        },
      },
    },
  });

  // Refund is valid for OPEN (cancellation), MATCHED (voided), CANCELLED (idempotency),
  // DISPUTED, or VOIDED states
  const allowedStatuses: string[] = [
    BetStatus.OPEN,
    BetStatus.MATCHED,
    BetStatus.CANCELLED,
    BetStatus.DISPUTED,
    BetStatus.VOIDED,
  ];
  if (!allowedStatuses.includes(bet.status)) {
    throw new EscrowError(
      `Cannot refund escrow for bet ${input.betId}: bet is in ${bet.status} status`
    );
  }

  const escrowAccount = await getEscrowAccountForBet(tx, input.betId);
  const escrowBalance = await getAccountBalance(tx, escrowAccount.id);

  if (escrowBalance.lt(amount)) {
    throw new EscrowError(
      `Escrow account for bet ${input.betId} has insufficient balance: ${escrowBalance}, requested ${amount}`
    );
  }

  const playerAccount = await getOrCreatePlayerAccount(tx, input.playerId);

  const result = await transfer(tx, {
    fromAccountId: escrowAccount.id,
    toAccountId: playerAccount.id,
    amount,
    transactionType: TransactionType.BET_ESCROW_REFUND,
    description: `Escrow refund for bet ${input.betId}`,
    betId: input.betId,
    idempotencyKey: input.idempotencyKey,
  });

  // Decrement developer escrow limit
  const escrowLimit = bet.game.developerProfile.escrowLimit;
  if (escrowLimit) {
    await tx.$executeRaw`
      UPDATE developer_escrow_limits
      SET current_escrow = GREATEST(current_escrow - ${amount}::decimal, 0),
          updated_at = NOW()
      WHERE id = ${escrowLimit.id}::uuid
    `;
  }

  return result;
}

// ---------------------------------------------------------------------------
// collectFee
// ---------------------------------------------------------------------------

/**
 * Move the platform fee from escrow to the PLATFORM_REVENUE system account.
 *
 * Called during settlement before releasing winnings.
 */
export async function collectFee(
  tx: TxClient,
  input: CollectFeeInput
): Promise<TransferResult> {
  const feeAmount = new Decimal(input.feeAmount.toString());

  if (feeAmount.lte(0)) {
    throw new EscrowError("Fee amount must be positive");
  }

  const bet = await tx.bet.findUniqueOrThrow({
    where: { id: input.betId },
  });

  if (
    bet.status !== BetStatus.RESULT_REPORTED &&
    bet.status !== BetStatus.DISPUTED &&
    bet.status !== BetStatus.SETTLED
  ) {
    throw new EscrowError(
      `Cannot collect fee for bet ${input.betId}: bet is in ${bet.status} status`
    );
  }

  const escrowAccount = await getEscrowAccountForBet(tx, input.betId);
  const escrowBalance = await getAccountBalance(tx, escrowAccount.id);

  if (escrowBalance.lt(feeAmount)) {
    throw new EscrowError(
      `Escrow account for bet ${input.betId} has insufficient balance for fee: ${escrowBalance}, fee ${feeAmount}`
    );
  }

  const platformRevenue = await getSystemAccount(
    tx,
    LedgerAccountType.PLATFORM_REVENUE
  );

  return transfer(tx, {
    fromAccountId: escrowAccount.id,
    toAccountId: platformRevenue.id,
    amount: feeAmount,
    transactionType: TransactionType.PLATFORM_FEE,
    description: `Platform fee for bet ${input.betId}`,
    betId: input.betId,
    idempotencyKey: input.idempotencyKey,
  });
}

// ---------------------------------------------------------------------------
// distributeDevShare
// ---------------------------------------------------------------------------

/**
 * Move a developer's revenue share from PLATFORM_REVENUE to their
 * DEVELOPER_BALANCE account.
 *
 * This is called after the platform fee has been collected. The dev share
 * comes out of the platform's revenue, not from escrow directly.
 */
export async function distributeDevShare(
  tx: TxClient,
  input: DistributeDevShareInput
): Promise<TransferResult> {
  const amount = new Decimal(input.amount.toString());

  if (amount.lte(0)) {
    throw new EscrowError("Developer share amount must be positive");
  }

  const platformRevenue = await getSystemAccount(
    tx,
    LedgerAccountType.PLATFORM_REVENUE
  );

  const platformBalance = await getAccountBalance(tx, platformRevenue.id);
  if (platformBalance.lt(amount)) {
    throw new EscrowError(
      `PLATFORM_REVENUE has insufficient balance for dev share: ${platformBalance}, requested ${amount}`
    );
  }

  const devAccount = await getOrCreateDeveloperAccount(
    tx,
    input.developerUserId
  );

  return transfer(tx, {
    fromAccountId: platformRevenue.id,
    toAccountId: devAccount.id,
    amount,
    transactionType: TransactionType.DEVELOPER_SHARE,
    description: `Developer revenue share`,
    idempotencyKey: input.idempotencyKey,
  });
}
