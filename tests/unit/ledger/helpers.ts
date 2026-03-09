import "dotenv/config";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  UserRole,
  LedgerAccountType,
} from "../../../generated/prisma/client.js";
import type { TxClient } from "../../../src/lib/db/client.js";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Test-specific Prisma client
// ---------------------------------------------------------------------------

let _testPrisma: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!_testPrisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set for tests");
    }
    const adapter = new PrismaPg({ connectionString });
    _testPrisma = new PrismaClient({ adapter });
  }
  return _testPrisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (_testPrisma) {
    await _testPrisma.$disconnect();
    _testPrisma = undefined;
  }
}

// ---------------------------------------------------------------------------
// Rollback transaction wrapper
// ---------------------------------------------------------------------------

/**
 * Run a test function inside a Prisma interactive transaction, then roll it
 * back so no data persists between tests.
 *
 * How it works: we start a transaction, call the test function with the
 * transaction client, then throw a sentinel error to force a rollback.
 * The sentinel is caught and swallowed so the test passes normally.
 */
const ROLLBACK_SENTINEL = "__TEST_ROLLBACK__";

export async function withRollback(
  fn: (tx: TxClient) => Promise<void>
): Promise<void> {
  const prisma = getTestPrisma();
  try {
    await prisma.$transaction(
      async (tx) => {
        await fn(tx);
        // Force rollback by throwing a sentinel
        throw new Error(ROLLBACK_SENTINEL);
      },
      { maxWait: 30_000, timeout: 60_000 }
    );
  } catch (error: unknown) {
    // Swallow the rollback sentinel; re-throw anything else
    if (error instanceof Error && error.message === ROLLBACK_SENTINEL) {
      return;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export interface TestSeeds {
  playerA: { id: string; email: string };
  playerB: { id: string; email: string };
  developer: { id: string; email: string };
  developerProfile: { id: string };
  game: { id: string; slug: string };
  escrowLimit: { id: string };
  systemAccounts: {
    platformRevenue: { id: string };
    stripeSource: { id: string };
    stripeSink: { id: string };
  };
}

/**
 * Seed the minimum required data inside a transaction for tests.
 *
 * Creates: two players, a developer with profile/game/escrow limit,
 * and the three system ledger accounts.
 */
export async function seedTestData(tx: TxClient): Promise<TestSeeds> {
  // Two test players
  const playerA = await tx.user.create({
    data: {
      email: `test-player-a-${crypto.randomUUID()}@test.com`,
      passwordHash: hashPassword("TestPlayer123!"),
      role: UserRole.PLAYER,
      displayName: "TestPlayerA",
      emailVerified: true,
    },
  });

  const playerB = await tx.user.create({
    data: {
      email: `test-player-b-${crypto.randomUUID()}@test.com`,
      passwordHash: hashPassword("TestPlayer456!"),
      role: UserRole.PLAYER,
      displayName: "TestPlayerB",
      emailVerified: true,
    },
  });

  // Developer user
  const developer = await tx.user.create({
    data: {
      email: `test-dev-${crypto.randomUUID()}@test.com`,
      passwordHash: hashPassword("TestDev123!"),
      role: UserRole.DEVELOPER,
      displayName: "TestDeveloper",
      emailVerified: true,
    },
  });

  // Developer profile
  const developerProfile = await tx.developerProfile.create({
    data: {
      userId: developer.id,
      companyName: "Test Studio",
      contactEmail: developer.email,
      revSharePercent: 0.02, // 2%
      isApproved: true,
    },
  });

  // Developer escrow limit
  const escrowLimit = await tx.developerEscrowLimit.create({
    data: {
      developerProfileId: developerProfile.id,
      maxTotalEscrow: 50000,
      maxSingleBet: 1000,
      currentEscrow: 0,
      tier: "STARTER",
    },
  });

  // Game
  const game = await tx.game.create({
    data: {
      developerProfileId: developerProfile.id,
      name: "Test Arena",
      slug: `test-arena-${crypto.randomUUID()}`,
      description: "Test game",
      isActive: true,
      minBetAmount: 1.0,
      maxBetAmount: 500.0,
      platformFeePercent: 0.05,
    },
  });

  // System accounts
  const platformRevenue = await tx.ledgerAccount.create({
    data: {
      accountType: LedgerAccountType.PLATFORM_REVENUE,
      balance: 0,
      currency: "USD",
    },
  });

  const stripeSource = await tx.ledgerAccount.create({
    data: {
      accountType: LedgerAccountType.STRIPE_SOURCE,
      balance: 0,
      currency: "USD",
    },
  });

  const stripeSink = await tx.ledgerAccount.create({
    data: {
      accountType: LedgerAccountType.STRIPE_SINK,
      balance: 0,
      currency: "USD",
    },
  });

  return {
    playerA: { id: playerA.id, email: playerA.email },
    playerB: { id: playerB.id, email: playerB.email },
    developer: { id: developer.id, email: developer.email },
    developerProfile: { id: developerProfile.id },
    game: { id: game.id, slug: game.slug },
    escrowLimit: { id: escrowLimit.id },
    systemAccounts: {
      platformRevenue: { id: platformRevenue.id },
      stripeSource: { id: stripeSource.id },
      stripeSink: { id: stripeSink.id },
    },
  };
}

/**
 * Fund a player's balance by simulating a Stripe deposit.
 *
 * In the real system, a Stripe deposit creates a double-entry transfer from
 * STRIPE_SOURCE to PLAYER_BALANCE, where STRIPE_SOURCE goes negative (it
 * represents external money entering the system).
 *
 * For tests, we first give STRIPE_SOURCE enough balance via raw SQL (no
 * ledger entry, so it sits outside the ledger's conservation envelope),
 * then run a proper double-entry transfer. This means:
 *   - The transfer() call creates balanced entries (debit SOURCE, credit PLAYER).
 *   - STRIPE_SOURCE's materialized balance will NOT match its entry sum because
 *     we primed it externally. This is expected for test helpers.
 *   - System conservation (global SUM of entries) still holds because every
 *     transfer() call creates balanced pairs.
 *
 * If your test needs perfect audit results, use the transfer function directly
 * with accounts you've set up carefully.
 */
export async function fundPlayer(
  tx: TxClient,
  userId: string,
  stripeSourceId: string,
  amount: string | number
): Promise<void> {
  const { Decimal } = await import("@prisma/client/runtime/client");
  const { getOrCreatePlayerAccount } = await import(
    "../../../src/lib/ledger/accounts.js"
  );
  const { transfer } = await import("../../../src/lib/ledger/transfer.js");
  const { TransactionType } = await import(
    "../../../generated/prisma/client.js"
  );

  const decimalAmount = new Decimal(amount.toString());

  // Give STRIPE_SOURCE enough balance for this transfer.
  // This raw UPDATE is outside the ledger (no entry), simulating external money.
  await tx.$executeRaw`
    UPDATE ledger_accounts
    SET balance = balance + ${decimalAmount}::decimal,
        updated_at = NOW()
    WHERE id = ${stripeSourceId}::uuid
  `;

  // Run the actual double-entry transfer
  const playerAccount = await getOrCreatePlayerAccount(tx, userId);

  await transfer(tx, {
    fromAccountId: stripeSourceId,
    toAccountId: playerAccount.id,
    amount: decimalAmount,
    transactionType: TransactionType.DEPOSIT,
    description: "Test deposit",
    idempotencyKey: `test_deposit_${userId}_${crypto.randomUUID()}`,
  });
}

/**
 * Create a bet in the database for testing. The bet will be in the specified status.
 */
export async function createTestBet(
  tx: TxClient,
  options: {
    gameId: string;
    playerAId: string;
    playerBId?: string;
    amount: number;
    status: string;
    platformFeePercent?: number;
  }
): Promise<{ id: string }> {
  const { BetStatus } = await import("../../../generated/prisma/client.js");

  const bet = await tx.bet.create({
    data: {
      gameId: options.gameId,
      playerAId: options.playerAId,
      playerBId: options.playerBId ?? null,
      amount: options.amount,
      status: options.status as any,
      platformFeePercent: options.platformFeePercent ?? 0.05,
      expiresAt: new Date(Date.now() + 300_000),
      playerAConsentedAt:
        options.status !== BetStatus.PENDING_CONSENT ? new Date() : null,
      playerBConsentedAt: options.playerBId ? new Date() : null,
      matchedAt: options.playerBId ? new Date() : null,
    },
  });

  return { id: bet.id };
}
