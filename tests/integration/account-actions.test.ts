// =============================================================================
// Integration Tests: Account restrictions (staff actions)
// =============================================================================
// Closing an account as under-18 must unwind every unsettled bet and return
// both stakes, end their sessions, and be audited. Suspension blocks gambling
// but not sign-in. Admin tools require a second factor.
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import {
  callApi,
  createFullScenario,
  createTestSession,
  createTestUser,
  disconnectTestPrisma,
  getPlayerBalance,
  getTestPrisma,
  purgeComplianceRecords,
} from "./helpers.js";
import { BetMatchType, BetStatus } from "../../generated/prisma/client.js";
import { holdEscrow } from "../../src/lib/ledger/escrow.js";
import type { TxClient } from "../../src/lib/db/client.js";

const prisma = getTestPrisma();
const tx = prisma as unknown as TxClient;
const createdUserIds: string[] = [];

let scenario: Awaited<ReturnType<typeof createFullScenario>>;
let adminToken: string;

beforeAll(async () => {
  scenario = await createFullScenario(tx, {
    playerABalance: 500,
    playerBBalance: 500,
    platformFeePercent: 0,
    revSharePercent: 0,
  });
  const admin = await createTestUser(tx, { role: "ADMIN", displayName: "Compliance Admin" });
  createdUserIds.push(admin.id);
  adminToken = (await createTestSession(tx, admin.id)).sessionToken;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await purgeComplianceRecords(prisma, createdUserIds);
  await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await disconnectTestPrisma();
});

async function matchedBet(amount = "10.00") {
  const stake = new Decimal(amount);
  const bet = await prisma.bet.create({
    data: {
      gameId: scenario.game.id,
      playerAId: scenario.playerA.id,
      amount: stake,
      currency: "USD",
      status: BetStatus.PENDING_CONSENT,
      matchType: BetMatchType.GAME_LOBBY,
      platformFeePercent: scenario.game.platformFeePercent,
      expiresAt: new Date(Date.now() + 300_000),
    },
  });
  await holdEscrow(tx, { playerId: scenario.playerA.id, betId: bet.id, amount: stake, idempotencyKey: `acct_a_${bet.id}` });
  await prisma.bet.update({ where: { id: bet.id }, data: { status: BetStatus.OPEN, playerAConsentedAt: new Date() } });
  await holdEscrow(tx, { playerId: scenario.playerB.id, betId: bet.id, amount: stake, idempotencyKey: `acct_b_${bet.id}` });
  return prisma.bet.update({
    where: { id: bet.id },
    data: { status: BetStatus.MATCHED, playerBId: scenario.playerB.id, matchedAt: new Date() },
  });
}

describe("Account status: under-18 closure", () => {
  it("voids unsettled bets, returns both stakes, ends sessions and is audited", async () => {
    const bet = await matchedBet();
    const aBefore = await getPlayerBalance(tx, scenario.playerA.id);
    const bBefore = await getPlayerBalance(tx, scenario.playerB.id);
    const playerSession = (await createTestSession(tx, scenario.playerB.id)).sessionToken;

    const res = await callApi("POST", `/api/admin/users/${scenario.playerB.id}/account-status`, {
      sessionToken: adminToken,
      body: { status: "CLOSED_UNDERAGE", reason: "Passport shows date of birth in 2010" },
    });
    expect(res.status).toBe(200);
    expect(res.body.voidedBetIds).toEqual([bet.id]);

    expect((await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } })).status).toBe(BetStatus.VOIDED);
    expect((await getPlayerBalance(tx, scenario.playerA.id)).minus(aBefore).toString()).toBe("10");
    expect((await getPlayerBalance(tx, scenario.playerB.id)).minus(bBefore).toString()).toBe("10");

    const balance = await callApi("GET", "/api/wallet/balance", { sessionToken: playerSession });
    expect(balance.status).toBe(401);

    const entry = await prisma.adminAuditLog.findFirst({
      where: { action: "user.account_status", targetId: scenario.playerB.id },
    });
    expect(entry?.details).toMatchObject({ to: "CLOSED_UNDERAGE", voidedBetIds: [bet.id] });
  });

  it("can't be reversed by a status change", async () => {
    const res = await callApi("POST", `/api/admin/users/${scenario.playerB.id}/account-status`, {
      sessionToken: adminToken,
      body: { status: "ACTIVE", reason: "Trying to reopen an under-18 closure" },
    });
    expect(res.status).toBe(409);
  });
});

describe("Account status: suspension", () => {
  it("blocks gambling but still lets the customer sign in", async () => {
    const player = await createTestUser(tx, { displayName: "Suspended" });
    createdUserIds.push(player.id);
    await prisma.user.update({ where: { id: player.id }, data: { kycStatus: "VERIFIED" } });
    const session = (await createTestSession(tx, player.id)).sessionToken;

    const res = await callApi("POST", `/api/admin/users/${player.id}/account-status`, {
      sessionToken: adminToken,
      body: { status: "SUSPENDED", reason: "Source of funds review in progress" },
    });
    expect(res.status).toBe(200);

    const balance = await callApi("GET", "/api/wallet/balance", { sessionToken: session });
    expect(balance.status).toBe(200);
    const deposit = await callApi("POST", "/api/wallet/deposit", {
      sessionToken: session,
      headers: { "x-forwarded-for": "10.77.0.1" },
      body: { amount: 1000, idempotencyKey: `suspended-${Date.now()}` },
    });
    expect(deposit.status).toBe(403);
    expect(deposit.body.code).toBe("ACCOUNT_RESTRICTED");
  });
});

describe("Self-exclusion on request", () => {
  it("lets staff self-exclude a customer who asked by email, audited", async () => {
    const player = await createTestUser(tx, { displayName: "Asked by email" });
    createdUserIds.push(player.id);
    const res = await callApi("POST", `/api/admin/users/${player.id}/self-exclusion`, {
      sessionToken: adminToken,
      body: { optionId: "1y", reason: "Customer emailed support asking to self-exclude for a year" },
    });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe("SELF_EXCLUSION");
    const entry = await prisma.adminAuditLog.findFirst({ where: { action: "user.self_exclusion", targetId: player.id } });
    expect(entry).not.toBeNull();
  });
});

describe("Admin tools", () => {
  it("require two-factor authentication when enforced", async () => {
    vi.stubEnv("ADMIN_2FA_REQUIRED", "true");
    const res = await callApi("GET", `/api/admin/users/${scenario.playerA.id}`, {
      sessionToken: adminToken,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_2FA_REQUIRED");
  });
});
