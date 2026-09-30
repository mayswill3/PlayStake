// =============================================================================
// Integration Tests: AML monitoring and withdrawal holds
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import {
  callApi,
  createFullScenario,
  createTestSession,
  createTestUser,
  disconnectTestPrisma,
  getTestPrisma,
  purgeComplianceRecords,
} from "./helpers.js";
import type { TxClient } from "../../src/lib/db/client.js";
import {
  AmlCaseStatus,
  AmlCaseType,
  BetMatchType,
  BetOutcome,
  BetStatus,
  TransactionStatus,
  TransactionType,
} from "../../generated/prisma/client.js";
import { centsToDollars } from "../../src/lib/utils/money.js";
import { assessWithdrawal, detectChipDumping } from "../../src/lib/compliance/aml-monitoring.js";
import { raiseAmlCase } from "../../src/lib/compliance/aml.js";
import { recordChargeback } from "../../src/lib/compliance/chargebacks.js";

const prisma = getTestPrisma();
const tx = prisma as unknown as TxClient;
const createdUserIds: string[] = [];
const createdTxIds: string[] = [];
const DAY = 24 * 60 * 60 * 1000;
let scenario: Awaited<ReturnType<typeof createFullScenario>>;

beforeAll(async () => {
  scenario = await createFullScenario(tx, { playerABalance: 1000, playerBBalance: 1000, platformFeePercent: 0, revSharePercent: 0 });
});

afterEach(() => vi.unstubAllEnvs());

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { id: { in: createdTxIds } } });
  await prisma.emailOutbox.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
  await purgeComplianceRecords(prisma, [...createdUserIds, scenario.playerA.id, scenario.playerB.id]);
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await disconnectTestPrisma();
});

async function player() {
  const user = await createTestUser(tx, {});
  createdUserIds.push(user.id);
  return user.id;
}

async function money(userId: string, type: TransactionType, cents: number, createdAt = new Date(), extra: Record<string, unknown> = {}) {
  const row = await prisma.transaction.create({
    data: {
      idempotencyKey: `aml-${type}-${userId}-${Math.random()}`,
      type,
      status: TransactionStatus.COMPLETED,
      amount: centsToDollars(cents),
      metadata: { userId },
      createdAt,
      ...extra,
    },
    select: { id: true },
  });
  createdTxIds.push(row.id);
}

describe("Chip dumping", () => {
  it("flags a pair where one side keeps winning the other's money", async () => {
    for (let i = 0; i < 6; i++) {
      await prisma.bet.create({
        data: {
          gameId: scenario.game.id,
          playerAId: scenario.playerA.id,
          playerBId: scenario.playerB.id,
          amount: new Decimal("25.00"),
          status: BetStatus.SETTLED,
          outcome: BetOutcome.PLAYER_B_WIN,
          matchType: BetMatchType.GAME_LOBBY,
          platformFeePercent: 0,
          expiresAt: new Date(),
          settledAt: new Date(Date.now() - i * 60 * 60 * 1000),
        },
      });
    }
    await detectChipDumping();
    const amlCase = await prisma.amlCase.findFirst({
      where: { type: AmlCaseType.CHIP_DUMPING, userId: scenario.playerB.id, relatedUserId: scenario.playerA.id },
    });
    expect(amlCase).not.toBeNull();
    expect(amlCase?.details).toMatchObject({ receiverWins: 6, netValueToReceiverCents: 15000 });
  });
});

describe("Withdrawal holds", () => {
  it("holds withdrawals while a medium or high case is open, but not a low one", async () => {
    const userId = await player();
    await raiseAmlCase({ userId, type: AmlCaseType.SHARED_IP, severity: "low", details: {} });
    await expect(assessWithdrawal(userId, 1000)).resolves.toBeUndefined();

    await raiseAmlCase({ userId, type: AmlCaseType.MANUAL, severity: "medium", details: {} });
    await expect(assessWithdrawal(userId, 1000)).rejects.toMatchObject({ code: "WITHDRAWAL_UNDER_REVIEW" });
  });

  it("holds a large withdrawal for review, then lets it through once cleared", async () => {
    vi.stubEnv("AML_WITHDRAWAL_REVIEW_THRESHOLD_CENTS", "50000");
    const userId = await player();
    await money(userId, TransactionType.DEPOSIT, 100_000, new Date(Date.now() - 20 * DAY));

    await expect(assessWithdrawal(userId, 60_000)).rejects.toMatchObject({ code: "WITHDRAWAL_UNDER_REVIEW" });
    const opened = await prisma.amlCase.findFirstOrThrow({ where: { userId, type: AmlCaseType.MANUAL } });
    expect(opened.details).toMatchObject({ kind: "large_withdrawal", amountCents: 60_000 });

    await prisma.amlCase.update({
      where: { id: opened.id },
      data: { status: AmlCaseStatus.CLOSED_NO_ACTION, closedAt: new Date() },
    });
    await expect(assessWithdrawal(userId, 60_000)).resolves.toBeUndefined();
  });

  it("holds money going straight back out with little play", async () => {
    const userId = await player();
    await money(userId, TransactionType.DEPOSIT, 20_000, new Date(Date.now() - 2 * DAY));
    await expect(assessWithdrawal(userId, 19_000)).rejects.toMatchObject({ code: "WITHDRAWAL_UNDER_REVIEW" });
    expect(await prisma.amlCase.findFirst({ where: { userId, type: AmlCaseType.DEPOSIT_WITHDRAW_NO_PLAY } })).not.toBeNull();
  });
});

describe("Chargebacks", () => {
  it("suspend the account and open a high-severity case", async () => {
    const userId = await player();
    await money(userId, TransactionType.DEPOSIT, 5_000, new Date(), { stripePaymentId: `pi_test_${userId}` });

    const affected = await recordChargeback({
      disputeId: "dp_test_1",
      paymentIntentId: `pi_test_${userId}`,
      amountCents: 5_000,
      reason: "fraudulent",
    });
    expect(affected).toBe(userId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.accountStatus).toBe("SUSPENDED");
    const amlCase = await prisma.amlCase.findFirstOrThrow({ where: { userId, type: AmlCaseType.CHARGEBACK } });
    expect(amlCase.severity).toBe("high");
  });
});

describe("MLRO decisions", () => {
  it("require reasoning, record the SAR reference and are audited", async () => {
    const userId = await player();
    const admin = await createTestUser(tx, { role: "ADMIN" });
    createdUserIds.push(admin.id);
    const adminToken = (await createTestSession(tx, admin.id)).sessionToken;
    const caseId = (await raiseAmlCase({ userId, type: AmlCaseType.MANUAL, severity: "high", details: {} }))!;

    const noReason = await callApi("POST", `/api/admin/aml/${caseId}`, {
      sessionToken: adminToken,
      body: { kind: "sar", sarReference: "NCA-123", decision: "" },
    });
    expect(noReason.status).toBe(422);

    const sar = await callApi("POST", `/api/admin/aml/${caseId}`, {
      sessionToken: adminToken,
      body: { kind: "sar", sarReference: "NCA-123", decision: "Deposits inconsistent with declared income" },
    });
    expect(sar.status).toBe(200);
    expect(sar.body.status).toBe(AmlCaseStatus.SAR_SUBMITTED);
    expect(sar.body.sarReference).toBe("NCA-123");
    expect(await prisma.adminAuditLog.findFirst({ where: { action: "aml_case.sar", targetId: caseId } })).not.toBeNull();
  });
});
