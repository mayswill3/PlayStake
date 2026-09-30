// =============================================================================
// Integration Tests: Customer interaction (identify, act, evaluate)
// =============================================================================

import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import {
  callApi,
  createTestSession,
  createTestUser,
  disconnectTestPrisma,
  getTestPrisma,
  purgeComplianceRecords,
} from "./helpers.js";
import type { TxClient } from "../../src/lib/db/client.js";
import {
  DepositLimitPeriod,
  InteractionOutcome,
  InteractionType,
  PlayBreakType,
  PlayerRiskType,
  TransactionStatus,
  TransactionType,
} from "../../generated/prisma/client.js";
import { centsToDollars } from "../../src/lib/utils/money.js";
import { detectPlayerRiskForUser } from "../../src/lib/responsible-play/risk.js";
import { evaluateDueInteractions } from "../../src/lib/responsible-play/interaction.js";
import { setDepositLimit } from "../../src/lib/responsible-play/service.js";

const prisma = getTestPrisma();
const tx = prisma as unknown as TxClient;
const createdUserIds: string[] = [];
const createdTxIds: string[] = [];
const DAY = 24 * 60 * 60 * 1000;

let ip = 0;
async function makePlayer(role: "PLAYER" | "ADMIN" = "PLAYER") {
  const user = await createTestUser(tx, { role });
  createdUserIds.push(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { kycStatus: "VERIFIED" } });
  const sessionToken = (await createTestSession(tx, user.id)).sessionToken;
  return { id: user.id, auth: { sessionToken, headers: { "x-forwarded-for": `10.66.${++ip}.1` } } };
}

async function deposit(userId: string, cents: number, createdAt: Date) {
  const row = await prisma.transaction.create({
    data: {
      idempotencyKey: `ci-dep-${userId}-${Math.random()}`,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amount: centsToDollars(cents),
      metadata: { userId },
      createdAt,
    },
    select: { id: true },
  });
  createdTxIds.push(row.id);
}

afterEach(() => vi.unstubAllEnvs());

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { id: { in: createdTxIds } } });
  await prisma.emailOutbox.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.depositLimit.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.responsiblePlaySettings.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
  await purgeComplianceRecords(prisma, createdUserIds);
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await disconnectTestPrisma();
});

describe("Identify and act", () => {
  it("rapid deposits raise a signal and put a message in front of the customer until they respond", async () => {
    const player = await makePlayer();
    for (let i = 0; i < 5; i++) await deposit(player.id, 1000, new Date(Date.now() - i * 5 * 60 * 1000));

    const raised = await detectPlayerRiskForUser(player.id);
    expect(raised).toHaveLength(1);
    const signal = await prisma.playerRiskSignal.findUniqueOrThrow({ where: { id: raised[0] } });
    expect(signal.type).toBe(PlayerRiskType.DEPOSIT_VELOCITY);

    const prompts = await callApi("GET", "/api/responsible-play/interactions", player.auth);
    expect(prompts.body.prompts).toHaveLength(1);
    expect(prompts.body.prompts[0].message).toMatch(/GamCare/);

    const answered = await callApi("POST", `/api/responsible-play/interactions/${prompts.body.prompts[0].id}`, {
      ...player.auth,
      body: { response: "set_limit" },
    });
    expect(answered.status).toBe(200);
    const interaction = await prisma.customerInteraction.findUniqueOrThrow({ where: { id: prompts.body.prompts[0].id } });
    expect(interaction.acknowledgedAt).not.toBeNull();
    expect(interaction.outcome).toBe(InteractionOutcome.ACKNOWLEDGED);
    expect((await callApi("GET", "/api/responsible-play/interactions", player.auth)).body.prompts).toHaveLength(0);
  });

  it("30-day deposits over the affordability threshold raise a check-in", async () => {
    vi.stubEnv("AFFORDABILITY_REVIEW_THRESHOLD_CENTS", "20000");
    const player = await makePlayer();
    await deposit(player.id, 12_000, new Date(Date.now() - 20 * DAY));
    await deposit(player.id, 9_000, new Date(Date.now() - 2 * DAY));

    const raised = await detectPlayerRiskForUser(player.id);
    const types = await prisma.playerRiskSignal.findMany({ where: { id: { in: raised } }, select: { type: true } });
    expect(types.map((row) => row.type)).toContain(PlayerRiskType.HIGH_DEPOSIT_VOLUME);
  });
});

describe("Evaluate", () => {
  async function pastInteraction(userId: string) {
    const createdAt = new Date(Date.now() - 15 * DAY);
    return prisma.customerInteraction.create({
      data: {
        userId,
        type: InteractionType.AUTOMATED_MESSAGE,
        message: "test",
        createdAt,
        followUpAt: new Date(createdAt.getTime() + 14 * DAY),
      },
    });
  }

  it("credits a break the customer took afterwards", async () => {
    const player = await makePlayer();
    const interaction = await pastInteraction(player.id);
    await prisma.playBreak.create({
      data: {
        userId: player.id,
        type: PlayBreakType.COOL_OFF,
        startsAt: new Date(Date.now() - 10 * DAY),
        endsAt: new Date(Date.now() - 9 * DAY),
        createdAt: new Date(Date.now() - 10 * DAY),
      },
    });
    await evaluateDueInteractions();
    const evaluated = await prisma.customerInteraction.findUniqueOrThrow({ where: { id: interaction.id } });
    expect(evaluated.outcome).toBe(InteractionOutcome.CUSTOMER_TOOK_BREAK);
  });

  it("records no change when spending carried on at the same level", async () => {
    const player = await makePlayer();
    const interaction = await pastInteraction(player.id);
    await deposit(player.id, 5_000, new Date(Date.now() - 20 * DAY));
    await deposit(player.id, 5_000, new Date(Date.now() - 5 * DAY));
    await evaluateDueInteractions();
    const evaluated = await prisma.customerInteraction.findUniqueOrThrow({ where: { id: interaction.id } });
    expect(evaluated.outcome).toBe(InteractionOutcome.BEHAVIOUR_UNCHANGED);
    expect(evaluated.outcomeNotes).toMatch(/14 days before/);
  });
});

describe("Staff action", () => {
  it("can apply a lower deposit limit, recorded as an interaction and audited", async () => {
    const player = await makePlayer();
    const admin = await makePlayer("ADMIN");
    const signal = await prisma.playerRiskSignal.create({
      data: {
        userId: player.id,
        type: PlayerRiskType.HIGH_DEPOSIT_VOLUME,
        severity: "high",
        details: {},
        windowStart: new Date(Date.now() - 30 * DAY),
        windowEnd: new Date(),
      },
    });

    const res = await callApi("POST", `/api/admin/harm-signals/${signal.id}`, {
      ...admin.auth,
      body: { kind: "apply_limit", period: "WEEKLY", amountCents: 10_000, message: "Agreed on a call" },
    });
    expect(res.status).toBe(200);
    const limit = await prisma.depositLimit.findFirstOrThrow({ where: { userId: player.id, period: DepositLimitPeriod.WEEKLY } });
    expect(limit.amount.toString()).toBe("100");
    expect(res.body.interactions[0].type).toBe(InteractionType.DEPOSIT_LIMIT_APPLIED);
    expect(
      await prisma.adminAuditLog.findFirst({ where: { action: "harm_signal.apply_limit", targetId: signal.id } }),
    ).not.toBeNull();

    // Staff can only tighten.
    const higher = await callApi("POST", `/api/admin/harm-signals/${signal.id}`, {
      ...admin.auth,
      body: { kind: "apply_limit", period: "WEEKLY", amountCents: 50_000, message: "Raise" },
    });
    expect(higher.status).toBe(409);
  });
});

describe("Deposit limit prompt", () => {
  it("must be answered before a first deposit", async () => {
    const player = await makePlayer();
    const first = await callApi("POST", "/api/wallet/deposit", {
      ...player.auth,
      body: { amount: 1000, idempotencyKey: `prompt-${Date.now()}` },
    });
    expect(first.status).toBe(409);
    expect(first.body.code).toBe("DEPOSIT_LIMIT_PROMPT");

    const declined = await callApi("POST", "/api/responsible-play/deposit-limit-prompt", {
      ...player.auth,
      body: { decision: "declined" },
    });
    expect(declined.status).toBe(200);

    const second = await callApi("POST", "/api/wallet/deposit", {
      ...player.auth,
      body: { amount: 1000, idempotencyKey: `prompt2-${Date.now()}` },
    });
    expect(second.body.code).not.toBe("DEPOSIT_LIMIT_PROMPT");
  });

  it("is answered by setting a limit", async () => {
    const player = await makePlayer();
    await setDepositLimit(player.id, DepositLimitPeriod.DAILY, 5_000);
    const res = await callApi("POST", "/api/wallet/deposit", {
      ...player.auth,
      body: { amount: 1000, idempotencyKey: `prompt3-${Date.now()}` },
    });
    expect(res.body.code).not.toBe("DEPOSIT_LIMIT_PROMPT");
  });
});
