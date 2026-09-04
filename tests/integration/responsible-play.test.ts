// =============================================================================
// Integration Tests: Responsible play controls
// =============================================================================
// Deposit limits, cool-off / self-exclusion, and the guarantees that matter:
// limits can be tightened instantly but never loosened on the spot, and a
// break blocks money in and betting while leaving withdrawals open.
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import {
  callApi,
  createTestSession,
  createTestUser,
  disconnectTestPrisma,
  getTestPrisma,
} from "./helpers.js";
import type { TxClient } from "../../src/lib/db/client.js";
import {
  DepositLimitPeriod,
  PlayBreakType,
  TransactionStatus,
  TransactionType,
} from "../../generated/prisma/client.js";
import { centsToDollars } from "../../src/lib/utils/money.js";
import { assertCanDeposit, assertCanWager } from "../../src/lib/responsible-play/policy.js";
import { getDepositLimits } from "../../src/lib/responsible-play/service.js";

const prisma = getTestPrisma();
const createdUserIds: string[] = [];
const createdTxIds: string[] = [];

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 250)}.${ipCounter % 250}.7`;
}

async function makePlayer() {
  const user = await createTestUser(prisma as unknown as TxClient, {});
  createdUserIds.push(user.id);
  // Deposits also require a verified identity, so clear that gate first.
  await prisma.user.update({
    where: { id: user.id },
    data: { kycStatus: "VERIFIED" },
  });
  const session = await createTestSession(prisma as unknown as TxClient, user.id);
  return {
    user,
    sessionToken: session.sessionToken,
    headers: { "x-forwarded-for": nextIp() },
  };
}

function as(actor: Awaited<ReturnType<typeof makePlayer>>) {
  return { sessionToken: actor.sessionToken, headers: actor.headers };
}

/** Record a completed deposit so it counts toward limit usage. */
async function seedDeposit(userId: string, cents: number, createdAt = new Date()) {
  const tx = await prisma.transaction.create({
    data: {
      idempotencyKey: `test-dep-${userId}-${Math.random()}`,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amount: centsToDollars(cents),
      metadata: { userId },
      createdAt,
    },
    select: { id: true },
  });
  createdTxIds.push(tx.id);
}

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { id: { in: createdTxIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.ledgerAccount.deleteMany({
    where: { userId: { in: createdUserIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await disconnectTestPrisma();
});

describe("Responsible play: deposit limits", () => {
  it("blocks a deposit that would exceed the limit", async () => {
    const actor = await makePlayer();

    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 10_000 },
    });
    await seedDeposit(actor.user.id, 8_000);

    // $30 on top of $80 used breaks a $100 daily limit.
    await expect(
      assertCanDeposit(actor.user.id, 3_000),
    ).rejects.toMatchObject({ code: "DEPOSIT_LIMIT_EXCEEDED" });

    // $15 still fits.
    await expect(assertCanDeposit(actor.user.id, 1_500)).resolves.toBeUndefined();
  });

  it("rejects the deposit route with a typed error", async () => {
    const actor = await makePlayer();
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 5_000 },
    });

    const res = await callApi("POST", "/api/wallet/deposit", {
      ...as(actor),
      body: { amount: 9_000, idempotencyKey: `rp-limit-${Date.now()}` },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("DEPOSIT_LIMIT_EXCEEDED");
  });

  it("ignores deposits that fell outside the rolling window", async () => {
    const actor = await makePlayer();
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 10_000 },
    });

    // Two days ago — outside the 24h window, so it must not count.
    await seedDeposit(
      actor.user.id,
      9_000,
      new Date(Date.now() - 48 * 60 * 60 * 1000),
    );

    await expect(assertCanDeposit(actor.user.id, 9_000)).resolves.toBeUndefined();
  });

  it("applies a decrease immediately", async () => {
    const actor = await makePlayer();
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 20_000 },
    });

    const res = await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 5_000 },
    });

    expect(res.status).toBe(200);
    expect(res.body.effectiveNow).toBe(true);

    const [limit] = await getDepositLimits(actor.user.id);
    expect(limit.amountCents).toBe(5_000);
    await expect(
      assertCanDeposit(actor.user.id, 6_000),
    ).rejects.toMatchObject({ code: "DEPOSIT_LIMIT_EXCEEDED" });
  });

  it("stages an increase behind the delay and keeps the old limit in force", async () => {
    const actor = await makePlayer();
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 5_000 },
    });

    const res = await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 50_000 },
    });

    expect(res.status).toBe(200);
    expect(res.body.effectiveNow).toBe(false);
    expect(res.body.effectiveAt).toBeTruthy();

    // The raise must not help until it matures.
    const [limit] = await getDepositLimits(actor.user.id);
    expect(limit.amountCents).toBe(5_000);
    expect(limit.pendingAmountCents).toBe(50_000);
    await expect(
      assertCanDeposit(actor.user.id, 20_000),
    ).rejects.toMatchObject({ code: "DEPOSIT_LIMIT_EXCEEDED" });
  });

  it("honours a matured increase even before the worker folds it in", async () => {
    const actor = await makePlayer();
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 5_000 },
    });
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 50_000 },
    });

    // Backdate the effective time; the stored row is untouched otherwise.
    await prisma.depositLimit.updateMany({
      where: { userId: actor.user.id, period: DepositLimitPeriod.DAILY },
      data: { pendingEffectiveAt: new Date(Date.now() - 1000) },
    });

    const [limit] = await getDepositLimits(actor.user.id);
    expect(limit.amountCents).toBe(50_000);
    await expect(
      assertCanDeposit(actor.user.id, 20_000),
    ).resolves.toBeUndefined();
  });

  it("lets a pending increase be cancelled", async () => {
    const actor = await makePlayer();
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 5_000 },
    });
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 50_000 },
    });

    const res = await callApi("DELETE", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", scope: "pending" },
    });
    expect(res.status).toBe(200);

    const [limit] = await getDepositLimits(actor.user.id);
    expect(limit.amountCents).toBe(5_000);
    expect(limit.pendingAmountCents).toBeNull();
  });

  it("supersedes a staged increase when the user lowers the limit instead", async () => {
    const actor = await makePlayer();
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 10_000 },
    });
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 90_000 },
    });
    await callApi("PUT", "/api/responsible-play/deposit-limits", {
      ...as(actor),
      body: { period: "DAILY", amount: 2_000 },
    });

    const [limit] = await getDepositLimits(actor.user.id);
    expect(limit.amountCents).toBe(2_000);
    expect(limit.pendingAmountCents).toBeNull();
  });
});

describe("Responsible play: breaks", () => {
  it("blocks deposits and wagering but leaves withdrawals open", async () => {
    const actor = await makePlayer();

    const started = await callApi("POST", "/api/responsible-play/break", {
      ...as(actor),
      body: { type: "COOL_OFF", optionId: "24h", acknowledged: true },
    });
    expect(started.status).toBe(201);

    await expect(
      assertCanDeposit(actor.user.id, 1_000),
    ).rejects.toMatchObject({ code: "PLAY_BREAK_ACTIVE" });
    await expect(assertCanWager(actor.user.id)).rejects.toMatchObject({
      code: "PLAY_BREAK_ACTIVE",
    });

    const deposit = await callApi("POST", "/api/wallet/deposit", {
      ...as(actor),
      body: { amount: 1_000, idempotencyKey: `rp-break-${Date.now()}` },
    });
    expect(deposit.status).toBe(403);
    expect(deposit.body.code).toBe("PLAY_BREAK_ACTIVE");

    // Withdrawals must stay reachable — the break must not trap funds. It gets
    // as far as the Connect check rather than being refused for the break.
    const withdraw = await callApi("POST", "/api/wallet/withdraw", {
      ...as(actor),
      body: { amount: 1_000, idempotencyKey: `rp-wd-${Date.now()}` },
    });
    expect(withdraw.body.code).not.toBe("PLAY_BREAK_ACTIVE");
  });

  it("refuses to shorten an active break", async () => {
    const actor = await makePlayer();

    await callApi("POST", "/api/responsible-play/break", {
      ...as(actor),
      body: { type: "SELF_EXCLUSION", optionId: "1y", acknowledged: true },
    });

    const shorter = await callApi("POST", "/api/responsible-play/break", {
      ...as(actor),
      body: { type: "COOL_OFF", optionId: "24h", acknowledged: true },
    });

    expect(shorter.status).toBe(409);
    expect(shorter.body.error).toMatch(/cannot be shortened|longer break/i);
  });

  it("allows extending to a longer break", async () => {
    const actor = await makePlayer();

    await callApi("POST", "/api/responsible-play/break", {
      ...as(actor),
      body: { type: "COOL_OFF", optionId: "24h", acknowledged: true },
    });
    const longer = await callApi("POST", "/api/responsible-play/break", {
      ...as(actor),
      body: { type: "SELF_EXCLUSION", optionId: "6mo", acknowledged: true },
    });

    expect(longer.status).toBe(201);
    expect(longer.body.type).toBe(PlayBreakType.SELF_EXCLUSION);
  });

  it("requires the user to acknowledge that a break is final", async () => {
    const actor = await makePlayer();

    const res = await callApi("POST", "/api/responsible-play/break", {
      ...as(actor),
      body: { type: "COOL_OFF", optionId: "24h" },
    });

    expect(res.status).toBe(422);
  });

  it("stops blocking once the break has elapsed", async () => {
    const actor = await makePlayer();

    await prisma.playBreak.create({
      data: {
        userId: actor.user.id,
        type: PlayBreakType.COOL_OFF,
        startsAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 1000),
      },
    });

    await expect(assertCanWager(actor.user.id)).resolves.toBeUndefined();
    await expect(assertCanDeposit(actor.user.id, 1_000)).resolves.toBeUndefined();
  });
});
