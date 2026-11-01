// =============================================================================
// Integration Tests: pulling out of a match before the referee starts it
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
import { BetMatchType, BetStatus, RefereeAssignmentStatus, RefereeProfileStatus } from "../../generated/prisma/client.js";
import { holdEscrow } from "../../src/lib/ledger/escrow.js";
import type { TxClient } from "../../src/lib/db/client.js";
import { assertNotInWithdrawalCooldown } from "../../src/lib/matches/withdraw.js";

const prisma = getTestPrisma();
const tx = prisma as unknown as TxClient;
const createdUserIds: string[] = [];
let scenario: Awaited<ReturnType<typeof createFullScenario>>;
let tokenA: string;
let refereeProfileId: string;

beforeAll(async () => {
  scenario = await createFullScenario(tx, { playerABalance: 500, playerBBalance: 500, platformFeePercent: 0.05, revSharePercent: 0 });
  tokenA = (await createTestSession(tx, scenario.playerA.id)).sessionToken;
  const referee = await createTestUser(tx, { displayName: "Withdraw Ref" });
  createdUserIds.push(referee.id);
  refereeProfileId = (
    await prisma.refereeProfile.create({ data: { userId: referee.id, status: RefereeProfileStatus.APPROVED, approvedAt: new Date() } })
  ).id;
});

afterAll(async () => {
  const betIds = (await prisma.bet.findMany({ where: { gameId: scenario.game.id }, select: { id: true } })).map((b) => b.id);
  await prisma.$executeRawUnsafe('ALTER TABLE "referee_audit_events" DISABLE TRIGGER "referee_audit_events_immutable"');
  try {
    await prisma.refereeAuditEvent.deleteMany({ where: { assignment: { betId: { in: betIds } } } });
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "referee_audit_events" ENABLE TRIGGER "referee_audit_events_immutable"');
  }
  await prisma.refereeAssignment.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.refereeProfile.deleteMany({ where: { id: refereeProfileId } });
  await purgeComplianceRecords(prisma, createdUserIds);
  await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await disconnectTestPrisma();
});

/** An agreed match with both stakes held, and a referee assignment at `status`. */
async function agreedMatch(status: RefereeAssignmentStatus = RefereeAssignmentStatus.OPEN, amount = "10.00") {
  const stake = new Decimal(amount);
  const bet = await prisma.bet.create({
    data: {
      gameId: scenario.game.id, playerAId: scenario.playerA.id, amount: stake, currency: "GBP", status: BetStatus.PENDING_CONSENT,
      matchType: BetMatchType.GAME_LOBBY, platformFeePercent: scenario.game.platformFeePercent, expiresAt: new Date(Date.now() + 300_000),
    },
  });
  await holdEscrow(tx, { playerId: scenario.playerA.id, betId: bet.id, amount: stake, idempotencyKey: `wd_a_${bet.id}` });
  await prisma.bet.update({ where: { id: bet.id }, data: { status: BetStatus.OPEN, playerAConsentedAt: new Date() } });
  await holdEscrow(tx, { playerId: scenario.playerB.id, betId: bet.id, amount: stake, idempotencyKey: `wd_b_${bet.id}` });
  await prisma.bet.update({ where: { id: bet.id }, data: { status: BetStatus.MATCHED, playerBId: scenario.playerB.id, matchedAt: new Date() } });
  const assignment = await prisma.refereeAssignment.create({
    data: { betId: bet.id, status, refereeProfileId: status === RefereeAssignmentStatus.OPEN ? null : refereeProfileId },
  });
  return { bet, assignment };
}

describe("Pulling out before the referee starts", () => {
  it("cancels the match and refunds both stakes in full, with no fee, and records who pulled out", async () => {
    const balanceA = await getPlayerBalance(prisma, scenario.playerA.id);
    const balanceB = await getPlayerBalance(prisma, scenario.playerB.id);
    const { bet, assignment } = await agreedMatch();
    expect(await getPlayerBalance(prisma, scenario.playerA.id)).toEqual(balanceA.minus(10));

    const res = await callApi("POST", `/api/bets/${bet.id}/withdraw`, { sessionToken: tokenA });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ refunded: true, stage: "OPEN" });

    expect((await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } })).status).toBe(BetStatus.VOIDED);
    expect(await getPlayerBalance(prisma, scenario.playerA.id)).toEqual(balanceA);
    expect(await getPlayerBalance(prisma, scenario.playerB.id)).toEqual(balanceB);
    expect((await prisma.refereeAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).status).toBe("CANCELLED");
    const event = await prisma.refereeAuditEvent.findFirst({ where: { assignmentId: assignment.id, action: "PLAYER_WITHDREW" } });
    expect(event).toMatchObject({ actorUserId: scenario.playerA.id });
    expect(event?.details).toMatchObject({ stage: "OPEN" });
  });

  it("is allowed after a referee has taken the match but before Start", async () => {
    const { bet } = await agreedMatch(RefereeAssignmentStatus.READY);
    const res = await callApi("POST", `/api/bets/${bet.id}/withdraw`, { sessionToken: tokenA });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe("READY");
  });

  it("is refused once the referee has started the match, and for anyone not in it", async () => {
    const started = await agreedMatch(RefereeAssignmentStatus.IN_PROGRESS);
    const refused = await callApi("POST", `/api/bets/${started.bet.id}/withdraw`, { sessionToken: tokenA });
    expect(refused.status).toBe(409);
    expect((await prisma.bet.findUniqueOrThrow({ where: { id: started.bet.id } })).status).toBe(BetStatus.MATCHED);
    await prisma.refereeAssignment.update({ where: { id: started.assignment.id }, data: { status: RefereeAssignmentStatus.CANCELLED } });

    const open = await agreedMatch();
    const stranger = await createTestUser(tx, { displayName: "Stranger" });
    createdUserIds.push(stranger.id);
    const strangerToken = (await createTestSession(tx, stranger.id)).sessionToken;
    expect((await callApi("POST", `/api/bets/${open.bet.id}/withdraw`, { sessionToken: strangerToken })).status).toBe(403);
    await callApi("POST", `/api/bets/${open.bet.id}/withdraw`, { sessionToken: tokenA }); // tidy
  });

  it("pauses new matches for 30 minutes after a third pull-out in 24 hours", async () => {
    // Player A has pulled out three times by now (tests above).
    const count = await prisma.refereeAuditEvent.count({ where: { actorUserId: scenario.playerA.id, action: "PLAYER_WITHDREW" } });
    expect(count).toBeGreaterThanOrEqual(3);
    await expect(assertNotInWithdrawalCooldown(scenario.playerA.id)).rejects.toMatchObject({ code: "WITHDRAWAL_COOLDOWN" });
    await expect(assertNotInWithdrawalCooldown(scenario.playerA.id, new Date(Date.now() + 31 * 60_000))).resolves.toBeUndefined();
    await expect(assertNotInWithdrawalCooldown(scenario.playerB.id)).resolves.toBeUndefined();
  });
});
