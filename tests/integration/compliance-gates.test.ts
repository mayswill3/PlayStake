// =============================================================================
// Integration Tests: Who may gamble
// =============================================================================
// The single gate in front of every deposit and stake (compliance/eligibility)
// and the self-exclusion rules around it: no automatic return, cooling-off on
// the way back, open activity withdrawn, optional email silenced, GAMSTOP
// respected.
// =============================================================================

import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import * as crypto from "crypto";
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
  AccountStatus,
  DepositLimitPeriod,
  KycStatus,
  LobbyRole,
  LobbyStatus,
  PlayBreakType,
} from "../../generated/prisma/client.js";
import { assertCanDeposit, assertCanWager } from "../../src/lib/responsible-play/policy.js";
import { getDepositLimits, setDepositLimit } from "../../src/lib/responsible-play/service.js";
import { queueEmail } from "../../src/lib/email/outbox.js";

const prisma = getTestPrisma();
const createdUserIds: string[] = [];
const DAY = 24 * 60 * 60 * 1000;

let ipCounter = 0;
async function makePlayer(kycStatus: KycStatus = KycStatus.VERIFIED) {
  const user = await createTestUser(prisma as unknown as TxClient, {});
  createdUserIds.push(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { kycStatus } });
  const session = await createTestSession(prisma as unknown as TxClient, user.id);
  ipCounter += 1;
  return {
    id: user.id,
    auth: { sessionToken: session.sessionToken, headers: { "x-forwarded-for": `10.9.${ipCounter}.1` } },
  };
}

async function selfExclusion(userId: string, endsAt: Date, extra: Record<string, Date> = {}) {
  return prisma.playBreak.create({
    data: {
      userId,
      type: PlayBreakType.SELF_EXCLUSION,
      startsAt: new Date(endsAt.getTime() - 182 * DAY),
      endsAt,
      ...extra,
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await prisma.emailOutbox.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.lobbyEntry.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.depositLimit.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
  await purgeComplianceRecords(prisma, createdUserIds);
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await disconnectTestPrisma();
});

describe("Eligibility gate", () => {
  it("refuses stakes and deposits until age and identity are verified", async () => {
    const player = await makePlayer(KycStatus.NOT_STARTED);
    await expect(assertCanWager(player.id)).rejects.toMatchObject({ code: "KYC_REQUIRED" });
    await expect(assertCanDeposit(player.id, 1000)).rejects.toMatchObject({ code: "KYC_REQUIRED" });
  });

  it("refuses free play on /play until age and identity are verified", async () => {
    const player = await makePlayer(KycStatus.NOT_STARTED);
    const res = await callApi("POST", "/api/demo/game", {
      ...player.auth,
      body: { gameType: "tictactoe" },
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("KYC_REQUIRED");
  });

  it("refuses a suspended account", async () => {
    const player = await makePlayer();
    await prisma.user.update({
      where: { id: player.id },
      data: { accountStatus: AccountStatus.SUSPENDED },
    });
    await expect(assertCanWager(player.id)).rejects.toMatchObject({ code: "ACCOUNT_RESTRICTED" });
    await expect(assertCanDeposit(player.id, 1000)).rejects.toMatchObject({
      code: "ACCOUNT_RESTRICTED",
    });
  });
});

describe("Self-exclusion", () => {
  it("does not lapse on its own once the period ends", async () => {
    const player = await makePlayer();
    await selfExclusion(player.id, new Date(Date.now() - 1000));

    await expect(assertCanWager(player.id)).rejects.toMatchObject({
      code: "PLAY_BREAK_ACTIVE",
      message: expect.stringMatching(/until you ask to return/),
    });
  });

  it("reopens only after the customer asks to return and a 24-hour cooling-off", async () => {
    const player = await makePlayer();
    const playBreak = await selfExclusion(player.id, new Date(Date.now() - 1000));

    const requested = await callApi("POST", "/api/responsible-play/break/return", {
      ...player.auth,
      body: { acknowledged: true },
    });
    expect(requested.status).toBe(200);
    const effectiveAt = new Date(requested.body.returnEffectiveAt).getTime();
    expect(effectiveAt - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);

    // Still closed during the cooling-off.
    await expect(assertCanWager(player.id)).rejects.toMatchObject({ code: "PLAY_BREAK_ACTIVE" });

    await prisma.playBreak.update({
      where: { id: playBreak.id },
      data: { returnEffectiveAt: new Date(Date.now() - 1000) },
    });
    await expect(assertCanWager(player.id)).resolves.toBeUndefined();
  });

  it("can't be returned from while the period is still running", async () => {
    const player = await makePlayer();
    await selfExclusion(player.id, new Date(Date.now() + 30 * DAY));

    const res = await callApi("POST", "/api/responsible-play/break/return", {
      ...player.auth,
      body: { acknowledged: true },
    });
    expect(res.status).toBe(409);
  });

  it("withdraws the customer's waiting lobby entries and returns invitees to the lobby", async () => {
    const player = await makePlayer();
    const invitee = await makePlayer();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const waiting = await prisma.lobbyEntry.create({
      data: { gameType: "darts", userId: player.id, role: LobbyRole.PLAYER_A, stakeAmount: 500, expiresAt },
    });
    const invited = await prisma.lobbyEntry.create({
      data: {
        gameType: "darts",
        userId: invitee.id,
        role: LobbyRole.PLAYER_B,
        stakeAmount: 500,
        status: LobbyStatus.INVITED,
        invitedById: player.id,
        expiresAt,
      },
    });

    const res = await callApi("POST", "/api/responsible-play/break", {
      ...player.auth,
      body: { type: "SELF_EXCLUSION", optionId: "6mo", acknowledged: true },
    });
    expect(res.status).toBe(201);

    expect((await prisma.lobbyEntry.findUniqueOrThrow({ where: { id: waiting.id } })).status).toBe(
      LobbyStatus.CANCELLED,
    );
    const released = await prisma.lobbyEntry.findUniqueOrThrow({ where: { id: invited.id } });
    expect(released.status).toBe(LobbyStatus.WAITING);
    expect(released.invitedById).toBeNull();
  });

  it("stops optional email but still sends essential email", async () => {
    const player = await makePlayer();
    await selfExclusion(player.id, new Date(Date.now() + 30 * DAY));

    await queueEmail({
      template: "bet.settled",
      payload: {
        name: "Test",
        betId: crypto.randomUUID(),
        gameName: "Darts",
        opponent: "Someone",
        result: "won",
        amount: "$5.00",
      } as never,
      dedupeKey: `test-optional-${player.id}`,
      userId: player.id,
    });
    await queueEmail({
      template: "responsible.break-ended",
      payload: { name: "Test", kind: "cool off" },
      dedupeKey: `test-essential-${player.id}`,
      userId: player.id,
    });

    const queued = await prisma.emailOutbox.findMany({
      where: { userId: player.id },
      select: { template: true },
    });
    expect(queued.map((row) => row.template)).toEqual(["responsible.break-ended"]);
  });
});

describe("Marketing and at-risk customers", () => {
  it("stops optional email for 30 days after a marker of harm", async () => {
    const player = await makePlayer();
    await prisma.playerRiskSignal.create({
      data: {
        userId: player.id,
        type: "LOSS_CHASING_STAKES",
        severity: "medium",
        details: {},
        windowStart: new Date(Date.now() - DAY),
        windowEnd: new Date(),
      },
    });
    await queueEmail({
      template: "bet.settled",
      payload: {} as never,
      dedupeKey: `test-at-risk-${player.id}`,
      userId: player.id,
    });
    expect(await prisma.emailOutbox.count({ where: { userId: player.id } })).toBe(0);
  });
});

describe("Deposit limits", () => {
  it("keeps a removed limit in force for 24 hours", async () => {
    const player = await makePlayer();
    await setDepositLimit(player.id, DepositLimitPeriod.DAILY, 5_000);

    const removed = await callApi("DELETE", "/api/responsible-play/deposit-limits", {
      ...player.auth,
      body: { period: "DAILY", scope: "limit" },
    });
    expect(removed.status).toBe(200);

    const limits = await getDepositLimits(player.id);
    expect(limits).toHaveLength(1);
    expect(limits[0]).toMatchObject({ amountCents: 5_000, pendingRemoval: true });
    await expect(assertCanDeposit(player.id, 6_000)).rejects.toMatchObject({
      code: "DEPOSIT_LIMIT_EXCEEDED",
    });

    // Once the delay has passed the limit is gone.
    expect(await getDepositLimits(player.id, new Date(Date.now() + 25 * 60 * 60 * 1000))).toHaveLength(0);
  });
});

describe("GAMSTOP", () => {
  async function playerWithIdentity() {
    const player = await makePlayer();
    await prisma.kycSubmission.create({
      data: {
        userId: player.id,
        status: "APPROVED",
        legalFirstName: "Ada",
        legalLastName: "Lovelace",
        dateOfBirth: new Date("1990-12-10"),
        addressLine1: "1 Test Street",
        city: "London",
        postalCode: "SW1A 1AA",
        country: "GB",
        documentType: "PASSPORT",
      },
    });
    return player;
  }

  function gamstopAnswers(exclusion: "Y" | "N" | "P") {
    vi.stubEnv("GAMSTOP_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(null, { status: 200, headers: { "X-Exclusion": exclusion } }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("refuses gambling to someone registered with GAMSTOP", async () => {
    const player = await playerWithIdentity();
    const fetchMock = gamstopAnswers("Y");

    await expect(assertCanWager(player.id)).rejects.toMatchObject({ code: "GAMSTOP_EXCLUDED" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get("dateOfBirth")).toBe("1990-12-10");
    expect(body.get("postcode")).toBe("SW1A 1AA");
  });

  it("allows someone not registered, and reuses the result for a day", async () => {
    const player = await playerWithIdentity();
    const fetchMock = gamstopAnswers("N");

    await expect(assertCanWager(player.id)).resolves.toBeUndefined();
    await expect(assertCanDeposit(player.id, 1000)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails closed when GAMSTOP can't be reached", async () => {
    const player = await playerWithIdentity();
    vi.stubEnv("GAMSTOP_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    await expect(assertCanWager(player.id)).rejects.toMatchObject({ code: "GAMSTOP_UNAVAILABLE" });
  });

  it("refuses gambling when GAMSTOP is required but not configured", async () => {
    const player = await playerWithIdentity();
    vi.stubEnv("GAMSTOP_API_KEY", "");
    vi.stubEnv("GAMSTOP_REQUIRED", "true");

    await expect(assertCanWager(player.id)).rejects.toMatchObject({ code: "GAMSTOP_UNAVAILABLE" });
  });
});
