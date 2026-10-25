// =============================================================================
// Integration Tests: dispute review by someone independent
// =============================================================================
// A disputed referee call is decided by an admin or an approved dispute
// reviewer who wasn't involved: never a player, never the match referee, and
// never anyone linked to a player by a follow or a block.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { callApi, createTestSession, disconnectTestPrisma, getTestPrisma, purgeComplianceRecords } from "./helpers.js";
import { BetOutcome, BetStatus, RefereeAssignmentStatus, RefereeProfileStatus } from "../../generated/prisma/client.js";
import { appendRefereeAudit } from "../../src/lib/referees/audit.js";
import { withTransaction } from "../../src/lib/db/client.js";

const prisma = getTestPrisma();
let gameId: string;

beforeAll(async () => {
  const dev = await prisma.user.upsert({
    where: { email: "dispute-rev-dev@playstake-test.com" },
    update: {},
    create: { email: "dispute-rev-dev@playstake-test.com", role: "DEVELOPER", displayName: "Dispute Rev Dev", emailVerified: true },
  });
  const profile = await prisma.developerProfile.upsert({
    where: { userId: dev.id },
    update: {},
    create: { userId: dev.id, companyName: "Dispute Rev Co", contactEmail: "dispute-rev-dev@playstake-test.com" },
  });
  const game = await prisma.game.upsert({
    where: { slug: "dispute-rev-game" },
    update: {},
    create: { developerProfileId: profile.id, name: "Dispute Rev Game", slug: "dispute-rev-game", platformFeePercent: new Decimal("0.05") },
  });
  gameId = game.id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { contains: "dispute-rev-" } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const bets = await prisma.bet.findMany({ where: { gameId }, select: { id: true } });
  const betIds = bets.map((bet) => bet.id);
  await prisma.$executeRawUnsafe('ALTER TABLE "referee_audit_events" DISABLE TRIGGER "referee_audit_events_immutable"');
  try {
    await prisma.refereeAuditEvent.deleteMany({ where: { assignment: { betId: { in: betIds } } } });
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "referee_audit_events" ENABLE TRIGGER "referee_audit_events_immutable"');
  }
  await prisma.matchRecording.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.refereeAssignment.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.dispute.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.refereeProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.bet.deleteMany({ where: { id: { in: betIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.developerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await purgeComplianceRecords(prisma, userIds);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectTestPrisma();
});

async function makeUser(name: string, role = "PLAYER") {
  const user = await prisma.user.create({
    data: { email: `dispute-rev-${crypto.randomUUID().slice(0, 8)}@playstake-test.com`, displayName: name, role: role as never, emailVerified: true },
  });
  const { sessionToken } = await createTestSession(prisma as never, user.id);
  return { ...user, token: sessionToken };
}

async function makeReferee(name: string, canReviewDisputes = false) {
  const user = await makeUser(name);
  const profile = await prisma.refereeProfile.create({
    data: { userId: user.id, status: RefereeProfileStatus.APPROVED, approvedAt: new Date(), canReviewDisputes },
  });
  return { ...user, profileId: profile.id };
}

/** A disputed match whose referee called it for player A. */
async function disputedMatch() {
  const playerA = await makeUser("Rev A");
  const playerB = await makeUser("Rev B");
  const referee = await makeReferee("Rev Match Referee");
  const bet = await prisma.bet.create({
    data: {
      gameId,
      playerAId: playerA.id,
      playerBId: playerB.id,
      amount: new Decimal("5.00"),
      status: BetStatus.DISPUTED,
      platformFeePercent: new Decimal("0.05"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  const startedAt = new Date(Date.now() - 20 * 60_000);
  const assignment = await prisma.refereeAssignment.create({
    data: {
      betId: bet.id,
      refereeProfileId: referee.profileId,
      status: RefereeAssignmentStatus.DISPUTED,
      decision: BetOutcome.PLAYER_A_WIN,
      evidence: { notes: "A scored the winner in the 88th minute." },
      startedAt,
      decisionSubmittedAt: new Date(),
    },
  });
  await withTransaction((tx) =>
    appendRefereeAudit(tx, { assignmentId: assignment.id, actorUserId: referee.id, action: "DECISION_SUBMITTED", details: {} }),
  );
  await prisma.matchChatMessage.create({ data: { betId: bet.id, userId: referee.id, body: "Kick-off" } });
  const dispute = await prisma.dispute.create({
    data: {
      betId: bet.id,
      filedById: playerB.id,
      reason: "The winner was offside; the referee missed it.",
      moments: [{ at: "87:40", note: "Offside build-up" }],
    },
  });
  return { playerA, playerB, referee, bet, assignment, dispute };
}

describe("who may review a dispute", () => {
  it("never the players, the match referee, an unapproved referee, or someone linked to a player", async () => {
    const { playerA, playerB, referee, dispute } = await disputedMatch();
    const unapproved = await makeReferee("Rev Plain Referee");
    const linked = await makeReferee("Rev Linked Reviewer", true);
    await prisma.refereeProfile.update({ where: { id: referee.profileId }, data: { canReviewDisputes: true } });
    await prisma.streamerFollow.create({ data: { followerId: linked.id, streamerId: playerA.id } });

    for (const user of [playerA, playerB, referee, unapproved, linked]) {
      const view = await callApi("GET", `/api/referees/disputes/${dispute.id}`, { sessionToken: user.token });
      expect(view.status, user.displayName).toBe(403);
      const list = await callApi("GET", "/api/referees/disputes", { sessionToken: user.token });
      expect(list.body.disputes.map((d: { id: string }) => d.id)).not.toContain(dispute.id);
    }
  });
});

describe("an approved dispute reviewer", () => {
  it("sees the evidence, takes the dispute, and overturns the call", async () => {
    const { assignment, referee, dispute, bet } = await disputedMatch();
    const reviewer = await makeReferee("Rev Reviewer", true);
    const other = await makeReferee("Rev Second Reviewer", true);

    const queue = await callApi("GET", "/api/referees/disputes", { sessionToken: reviewer.token });
    expect(queue.body.disputes.map((d: { id: string }) => d.id)).toContain(dispute.id);

    const evidence = await callApi("GET", `/api/referees/disputes/${dispute.id}`, { sessionToken: reviewer.token });
    expect(evidence.status).toBe(200);
    expect(evidence.body.moments).toEqual([{ at: "87:40", note: "Offside build-up" }]);
    expect(evidence.body.bet.refereeAssignment.evidence.notes).toMatch(/88th minute/);
    expect(evidence.body.bet.chatMessages).toHaveLength(1);
    expect(evidence.body.bet.recordings).toEqual([]);

    // Deciding before taking it is refused.
    const early = await callApi("PATCH", `/api/referees/disputes/${dispute.id}`, {
      sessionToken: reviewer.token,
      body: { status: "RESOLVED_PLAYER_B", resolution: "Offside goal, B wins" },
    });
    expect(early.status).toBe(403);

    expect((await callApi("POST", `/api/referees/disputes/${dispute.id}`, { sessionToken: reviewer.token })).status).toBe(200);
    // Nobody else can take it now.
    expect((await callApi("POST", `/api/referees/disputes/${dispute.id}`, { sessionToken: other.token })).status).toBe(403);

    const decided = await callApi("PATCH", `/api/referees/disputes/${dispute.id}`, {
      sessionToken: reviewer.token,
      body: { status: "RESOLVED_PLAYER_B", resolution: "The winning goal was offside at 87:40 on both streams." },
    });
    expect(decided.status).toBe(200);

    const after = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(after.outcome).toBe(BetOutcome.PLAYER_B_WIN);
    const updated = await prisma.refereeAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.decision).toBe(BetOutcome.PLAYER_A_WIN);
    expect(updated.overturnedOutcome).toBe(BetOutcome.PLAYER_B_WIN);
    const refProfile = await prisma.refereeProfile.findUniqueOrThrow({ where: { id: referee.profileId } });
    expect(refProfile.disputesUpheld).toBe(1);

    const actions = await prisma.refereeAuditEvent.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { sequence: "asc" },
      select: { action: true, details: true },
    });
    const claimed = actions.find((a) => a.action === "DISPUTE_REVIEW_CLAIMED");
    const resolved = actions.find((a) => a.action === "DISPUTE_RESOLVED");
    expect(claimed?.details).toMatchObject({ reviewerRole: "DISPUTE_REVIEWER" });
    expect(resolved?.details).toMatchObject({ reviewerRole: "DISPUTE_REVIEWER", overturned: true });
  });

  it("loses access when the referee is suspended", async () => {
    const reviewer = await makeReferee("Rev Suspended Reviewer", true);
    const admin = await makeUser("Rev Admin", "ADMIN");
    const res = await callApi("PATCH", `/api/admin/referees/${reviewer.profileId}`, {
      sessionToken: admin.token,
      body: { status: "SUSPENDED" },
    });
    expect(res.status).toBe(200);
    const profile = await prisma.refereeProfile.findUniqueOrThrow({ where: { id: reviewer.profileId } });
    expect(profile.canReviewDisputes).toBe(false);
  });
});

describe("admins", () => {
  it("grant dispute reviewing, and can decide without taking the dispute", async () => {
    const { dispute, bet } = await disputedMatch();
    const admin = await makeUser("Rev Admin 2", "ADMIN");
    const candidate = await makeReferee("Rev Candidate");

    const granted = await callApi("PATCH", `/api/admin/referees/${candidate.profileId}`, {
      sessionToken: admin.token,
      body: { canReviewDisputes: true },
    });
    expect(granted.status).toBe(200);
    expect(granted.body.canReviewDisputes).toBe(true);

    const decided = await callApi("PATCH", `/api/admin/disputes/${dispute.id}`, {
      sessionToken: admin.token,
      body: { status: "RESOLVED_PLAYER_A", resolution: "Goal stands; the replay shows it onside." },
    });
    expect(decided.status).toBe(200);
    expect((await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } })).outcome).toBe(BetOutcome.PLAYER_A_WIN);
  });
});
