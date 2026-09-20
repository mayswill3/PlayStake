// =============================================================================
// Integration Tests: Loss-chasing detection
// =============================================================================
// This is a harm marker, so both failure directions are costly: missing a real
// pattern fails the player, and crying wolf trains whoever reviews these to
// ignore them. The thresholds are the product, so they are pinned here —
// including the cases that must NOT raise anything.
// =============================================================================

import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import {
  BetMatchType,
  BetOutcome,
  BetStatus,
  PlayerRiskType,
  TransactionStatus,
  TransactionType,
} from "../../generated/prisma/client.js";
import {
  detectLossChasingForUser,
  DEPOSIT_AFTER_LOSS_MS,
  MIN_LOSS_STREAK,
} from "../../src/lib/responsible-play/risk.js";

const prisma = getTestPrisma();
const MINUTE = 60 * 1000;

let gameId: string;

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `chase-${label}-${crypto.randomUUID().slice(0, 8)}@playstake-test.com`,
      displayName: `Chaser ${label}`,
      emailVerified: true,
    },
  });
}

async function ensureGame() {
  if (gameId) return gameId;
  const devUser = await makeUser("dev");
  const profile = await prisma.developerProfile.create({
    data: {
      userId: devUser.id,
      companyName: "Chase Co",
      contactEmail: `chase-dev-${crypto.randomUUID().slice(0, 8)}@playstake-test.com`,
    },
  });
  const game = await prisma.game.create({
    data: {
      developerProfileId: profile.id,
      name: "Chase Game",
      slug: `chase-game-${crypto.randomUUID().slice(0, 8)}`,
      platformFeePercent: new Decimal("0.05"),
    },
  });
  gameId = game.id;
  return gameId;
}

/** A settled bet where `loser` lost `stakeCents`, settled `minutesAgo`. */
async function settledLoss(
  loserId: string,
  opponentId: string,
  stakeCents: number,
  minutesAgo: number,
  outcome: BetOutcome = BetOutcome.PLAYER_B_WIN,
) {
  const settledAt = new Date(Date.now() - minutesAgo * MINUTE);
  return prisma.bet.create({
    data: {
      gameId: await ensureGame(),
      // loser is always player A here, so PLAYER_B_WIN means they lost.
      playerAId: loserId,
      playerBId: opponentId,
      amount: new Decimal((stakeCents / 100).toFixed(2)),
      status: BetStatus.SETTLED,
      matchType: BetMatchType.GAME_LOBBY,
      platformFeePercent: new Decimal("0.05"),
      outcome,
      expiresAt: new Date(Date.now() + 3_600_000),
      matchedAt: settledAt,
      settledAt,
    },
  });
}

async function deposit(userId: string, cents: number, minutesAgo: number) {
  return prisma.transaction.create({
    data: {
      idempotencyKey: `chase-dep-${crypto.randomUUID()}`,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amount: new Decimal((cents / 100).toFixed(2)),
      metadata: { userId },
      createdAt: new Date(Date.now() - minutesAgo * MINUTE),
    },
  });
}

beforeEach(() => {
  // The detector emails an admin alert; keep tests off the network.
  vi.stubEnv("EMAIL_ADMIN", "");
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { contains: "chase-" } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.playerRiskSignal.deleteMany({ where: { userId: { in: ids } } });
  await prisma.transaction.deleteMany({
    where: { idempotencyKey: { startsWith: "chase-dep-" } },
  });
  if (gameId) await prisma.bet.deleteMany({ where: { gameId } });
  await prisma.emailOutbox.deleteMany({ where: { userId: { in: ids } } });
  if (gameId) await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.developerProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await disconnectTestPrisma();
});

describe("Loss chasing: escalating stakes", () => {
  it("raises a signal when stakes double across a losing run", async () => {
    const player = await makeUser("escalate");
    const opponent = await makeUser("opp");

    // £5 → £10 → £20 across three straight losses.
    await settledLoss(player.id, opponent.id, 500, 180);
    await settledLoss(player.id, opponent.id, 1000, 120);
    await settledLoss(player.id, opponent.id, 2000, 60);

    const raised = await detectLossChasingForUser(player.id);
    expect(raised).toHaveLength(1);

    const signal = await prisma.playerRiskSignal.findFirstOrThrow({
      where: { userId: player.id },
    });
    expect(signal.type).toBe(PlayerRiskType.LOSS_CHASING_STAKES);
    expect(signal.severity).toBe("high"); // 4x
    const details = signal.details as Record<string, number>;
    expect(details.consecutiveLosses).toBe(3);
    expect(details.firstStakeCents).toBe(500);
    expect(details.lastStakeCents).toBe(2000);
  });

  it("ignores a losing run at a flat stake", async () => {
    const player = await makeUser("flat");
    const opponent = await makeUser("opp");

    // Losing repeatedly is not the marker; escalating is.
    await settledLoss(player.id, opponent.id, 500, 180);
    await settledLoss(player.id, opponent.id, 500, 120);
    await settledLoss(player.id, opponent.id, 500, 60);

    expect(await detectLossChasingForUser(player.id)).toHaveLength(0);
  });

  it("ignores escalation that isn't a run — a win resets it", async () => {
    const player = await makeUser("reset");
    const opponent = await makeUser("opp");

    await settledLoss(player.id, opponent.id, 500, 180);
    await settledLoss(player.id, opponent.id, 1000, 150);
    // A win breaks the streak; the later big loss starts a new, shorter one.
    await settledLoss(player.id, opponent.id, 500, 120, BetOutcome.PLAYER_A_WIN);
    await settledLoss(player.id, opponent.id, 4000, 60);

    expect(await detectLossChasingForUser(player.id)).toHaveLength(0);
  });

  it("does not count a draw as a loss", async () => {
    const player = await makeUser("draw");
    const opponent = await makeUser("opp");

    await settledLoss(player.id, opponent.id, 500, 180);
    await settledLoss(player.id, opponent.id, 1000, 120, BetOutcome.DRAW);
    await settledLoss(player.id, opponent.id, 2000, 60);

    expect(await detectLossChasingForUser(player.id)).toHaveLength(0);
  });

  it(`needs at least ${MIN_LOSS_STREAK} losses`, async () => {
    const player = await makeUser("short");
    const opponent = await makeUser("opp");

    await settledLoss(player.id, opponent.id, 500, 120);
    await settledLoss(player.id, opponent.id, 5000, 60); // 10x, but only two

    expect(await detectLossChasingForUser(player.id)).toHaveLength(0);
  });
});

describe("Loss chasing: depositing after losses", () => {
  it("raises a signal on repeated top-ups straight after losing", async () => {
    const player = await makeUser("topup");
    const opponent = await makeUser("opp");

    for (const minutesAgo of [180, 120, 60]) {
      await settledLoss(player.id, opponent.id, 500, minutesAgo);
      // Deposited five minutes after each loss.
      await deposit(player.id, 2000, minutesAgo - 5);
    }

    const raised = await detectLossChasingForUser(player.id);
    const signal = await prisma.playerRiskSignal.findFirstOrThrow({
      where: { userId: player.id, type: PlayerRiskType.LOSS_CHASING_DEPOSITS },
    });

    expect(raised.length).toBeGreaterThanOrEqual(1);
    const details = signal.details as Record<string, number>;
    expect(details.depositsAfterLoss).toBe(3);
    expect(details.totalDepositedCents).toBe(6000);
  });

  it("ignores deposits that are not close to a loss", async () => {
    const player = await makeUser("unrelated");
    const opponent = await makeUser("opp");

    const gapMinutes = DEPOSIT_AFTER_LOSS_MS / MINUTE + 30;
    for (const minutesAgo of [300, 240, 180]) {
      await settledLoss(player.id, opponent.id, 500, minutesAgo);
      // Deposited well after, not in the moment.
      await deposit(player.id, 2000, minutesAgo - gapMinutes);
    }

    expect(await detectLossChasingForUser(player.id)).toHaveLength(0);
  });

  it("ignores a deposit made before the loss", async () => {
    const player = await makeUser("before");
    const opponent = await makeUser("opp");

    for (const minutesAgo of [180, 120, 60]) {
      await settledLoss(player.id, opponent.id, 500, minutesAgo);
      // Topped up five minutes BEFORE losing — ordinary play.
      await deposit(player.id, 2000, minutesAgo + 5);
    }

    expect(await detectLossChasingForUser(player.id)).toHaveLength(0);
  });
});

describe("Loss chasing: not crying wolf", () => {
  it("does not re-raise the same signal on the next scan", async () => {
    const player = await makeUser("cooldown");
    const opponent = await makeUser("opp");

    await settledLoss(player.id, opponent.id, 500, 180);
    await settledLoss(player.id, opponent.id, 1000, 120);
    await settledLoss(player.id, opponent.id, 2000, 60);

    const first = await detectLossChasingForUser(player.id);
    expect(first).toHaveLength(1);

    // The scan runs every 15 minutes against a 24-hour window; without a
    // cooldown one bad evening would generate dozens of identical alerts.
    const second = await detectLossChasingForUser(player.id);
    expect(second).toHaveLength(0);

    const all = await prisma.playerRiskSignal.findMany({
      where: { userId: player.id, type: PlayerRiskType.LOSS_CHASING_STAKES },
    });
    expect(all).toHaveLength(1);
  });

  it("leaves a player with no settled bets alone", async () => {
    const player = await makeUser("quiet");
    expect(await detectLossChasingForUser(player.id)).toHaveLength(0);
  });
});
