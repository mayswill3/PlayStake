// =============================================================================
// Integration Tests: Referee operations
// =============================================================================
// Decision quality is only measurable if a referee's own call survives an
// admin resolving the dispute on top of it, and if an overturn is actually
// recorded somewhere queryable.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import {
  callApi,
  createTestSession,
  disconnectTestPrisma,
  getTestPrisma,
  purgeComplianceRecords,
} from "./helpers.js";
import {
  BetOutcome,
  BetStatus,
  RefereeAssignmentStatus,
  RefereeProfileStatus,
} from "../../generated/prisma/client.js";
import {
  MIN_DECISIONS_FOR_RATE,
  getRefereeCapacity,
  getRefereePerformance,
} from "../../src/lib/referees/metrics.js";

const prisma = getTestPrisma();
let gameId: string;
let adminToken: string;

beforeAll(async () => {
  const devUser = await prisma.user.upsert({
    where: { email: "ref-ops-dev@playstake-test.com" },
    update: {},
    create: {
      email: "ref-ops-dev@playstake-test.com",
      role: "DEVELOPER",
      displayName: "Ref Ops Dev",
      emailVerified: true,
    },
  });

  const profile = await prisma.developerProfile.upsert({
    where: { userId: devUser.id },
    update: {},
    create: {
      userId: devUser.id,
      companyName: "Ref Ops Co",
      contactEmail: "ref-ops-dev@playstake-test.com",
    },
  });

  const game = await prisma.game.upsert({
    where: { slug: "ref-ops-game" },
    update: {},
    create: {
      developerProfileId: profile.id,
      name: "Ref Ops Game",
      slug: "ref-ops-game",
      platformFeePercent: new Decimal("0.05"),
    },
  });
  gameId = game.id;

  const admin = await makeUser("Ref Ops Admin", "ADMIN");
  adminToken = (await createTestSession(prisma as never, admin.id)).sessionToken;
});

afterAll(async () => {
  // Match on the email prefix rather than this run's ids, so a run that died
  // before teardown does not leave approved referees behind — getRefereeCapacity
  // counts globally, and stale rows would skew a later run's assertions.
  const users = await prisma.user.findMany({
    where: { email: { contains: "ref-ops-" } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  const bets = await prisma.bet.findMany({
    where: {
      OR: [
        { gameId },
        { playerAId: { in: userIds } },
        { playerBId: { in: userIds } },
      ],
    },
    select: { id: true },
  });
  const betIds = bets.map((bet) => bet.id);

  // referee_audit_events carries an append-only trigger, deliberately, so the
  // chain cannot be rewritten by application code. Teardown suspends it for
  // this table only, long enough to remove the rows this suite created.
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "referee_audit_events" DISABLE TRIGGER "referee_audit_events_immutable"',
  );
  try {
    await prisma.refereeAuditEvent.deleteMany({
      where: { assignment: { betId: { in: betIds } } },
    });
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "referee_audit_events" ENABLE TRIGGER "referee_audit_events_immutable"',
    );
  }
  await prisma.refereeAssignment.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.dispute.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.refereeQualification.deleteMany({
    where: { refereeProfile: { userId: { in: userIds } } },
  });
  await prisma.refereeProfile.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.bet.deleteMany({ where: { id: { in: betIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.developerProfile.deleteMany({
    where: { userId: { in: userIds } },
  });
  await purgeComplianceRecords(prisma, userIds);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectTestPrisma();
});

async function makeUser(displayName: string, role = "PLAYER") {
  const uid = crypto.randomUUID().substring(0, 8);
  const user = await prisma.user.create({
    data: {
      email: `ref-ops-${uid}@playstake-test.com`,
      displayName,
      role: role as never,
      emailVerified: true,
    },
  });
  return user;
}

/** A disputed bet whose referee has already submitted `decision`. */
async function disputedMatchWithDecision(decision: BetOutcome) {
  const playerA = await makeUser("Ref Ops A");
  const playerB = await makeUser("Ref Ops B");
  const refUser = await makeUser("Ref Ops Referee");

  const refereeProfile = await prisma.refereeProfile.create({
    data: {
      userId: refUser.id,
      status: RefereeProfileStatus.APPROVED,
      isAvailable: true,
      approvedAt: new Date(),
    },
  });

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

  const claimedAt = new Date(Date.now() - 600_000);
  const assignment = await prisma.refereeAssignment.create({
    data: {
      betId: bet.id,
      refereeProfileId: refereeProfile.id,
      status: RefereeAssignmentStatus.DECISION_SUBMITTED,
      decision,
      claimedAt,
      decisionSubmittedAt: new Date(claimedAt.getTime() + 120_000),
    },
  });

  const dispute = await prisma.dispute.create({
    data: { betId: bet.id, filedById: playerB.id, reason: "Disagree" },
  });

  return { bet, assignment, dispute, refereeProfile };
}

describe("Referee operations: overturn tracking", () => {
  it("keeps the referee's decision and records the overturn", async () => {
    const { assignment, dispute, refereeProfile } =
      await disputedMatchWithDecision(BetOutcome.PLAYER_A_WIN);

    // Admin resolves the other way.
    const res = await callApi("PATCH", `/api/admin/disputes/${dispute.id}`, {
      sessionToken: adminToken,
      body: {
        status: "RESOLVED_PLAYER_B",
        resolution: "Video shows player B landed the winning throw",
      },
    });
    expect(res.status).toBe(200);

    const updated = await prisma.refereeAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });

    // The referee's original call must survive — it used to be overwritten.
    expect(updated.decision).toBe(BetOutcome.PLAYER_A_WIN);
    expect(updated.overturnedOutcome).toBe(BetOutcome.PLAYER_B_WIN);
    expect(updated.overturnedAt).not.toBeNull();

    const profile = await prisma.refereeProfile.findUniqueOrThrow({
      where: { id: refereeProfile.id },
    });
    expect(profile.disputesUpheld).toBe(1);
  });

  it("does not count an overturn when the admin agrees with the referee", async () => {
    const { assignment, dispute, refereeProfile } =
      await disputedMatchWithDecision(BetOutcome.PLAYER_A_WIN);

    const res = await callApi("PATCH", `/api/admin/disputes/${dispute.id}`, {
      sessionToken: adminToken,
      body: {
        status: "RESOLVED_PLAYER_A",
        resolution: "Referee call confirmed on review",
      },
    });
    expect(res.status).toBe(200);

    const updated = await prisma.refereeAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(updated.decision).toBe(BetOutcome.PLAYER_A_WIN);
    expect(updated.overturnedAt).toBeNull();

    const profile = await prisma.refereeProfile.findUniqueOrThrow({
      where: { id: refereeProfile.id },
    });
    expect(profile.disputesUpheld).toBe(0);
  });

  it("records the referee's decision in the audit trail", async () => {
    const { assignment, dispute } = await disputedMatchWithDecision(
      BetOutcome.PLAYER_A_WIN,
    );

    await callApi("PATCH", `/api/admin/disputes/${dispute.id}`, {
      sessionToken: adminToken,
      body: { status: "RESOLVED_PLAYER_B", resolution: "Overturned on review" },
    });

    const event = await prisma.refereeAuditEvent.findFirst({
      where: { assignmentId: assignment.id, action: "DISPUTE_RESOLVED" },
    });
    const details = event?.details as Record<string, unknown>;
    expect(details.overturned).toBe(true);
    expect(details.refereeDecision).toBe(BetOutcome.PLAYER_A_WIN);
  });
});

describe("Referee operations: admin history", () => {
  it("shows an admin the call, overturn, notes and audit trail", async () => {
    const { assignment, dispute, refereeProfile } = await disputedMatchWithDecision(
      BetOutcome.PLAYER_A_WIN,
    );
    await prisma.refereeAssignment.update({
      where: { id: assignment.id },
      data: { evidence: { notes: "Player A hit the double on the last throw" } },
    });
    await callApi("PATCH", `/api/admin/disputes/${dispute.id}`, {
      sessionToken: adminToken,
      body: { status: "RESOLVED_PLAYER_B", resolution: "Overturned on review" },
    });

    const res = await callApi(
      "GET",
      `/api/admin/referees/${refereeProfile.id}/assignments`,
      { sessionToken: adminToken },
    );
    expect(res.status).toBe(200);
    expect(res.body.referee.id).toBe(refereeProfile.id);
    const [row] = res.body.assignments;
    expect(row.id).toBe(assignment.id);
    expect(row.decision).toBe(BetOutcome.PLAYER_A_WIN);
    expect(row.overturnedOutcome).toBe(BetOutcome.PLAYER_B_WIN);
    expect(row.evidence.notes).toBe("Player A hit the double on the last throw");
    expect(row.bet.playerA.displayName).toBe("Ref Ops A");

    const resolved = row.auditEvents.find(
      (event: { action: string }) => event.action === "DISPUTE_RESOLVED",
    );
    expect(resolved).toBeDefined();
    // Request fingerprints stay out of the admin view.
    expect(resolved).not.toHaveProperty("ipHash");
    expect(resolved).not.toHaveProperty("userAgent");
  });

  it("refuses non-admins", async () => {
    const { refereeProfile } = await disputedMatchWithDecision(BetOutcome.PLAYER_A_WIN);
    const player = await makeUser("Ref Ops Nosy Player");
    const playerToken = (await createTestSession(prisma as never, player.id)).sessionToken;

    const res = await callApi(
      "GET",
      `/api/admin/referees/${refereeProfile.id}/assignments`,
      { sessionToken: playerToken },
    );
    expect(res.status).toBe(403);
  });

  it("404s for an unknown referee", async () => {
    const res = await callApi(
      "GET",
      `/api/admin/referees/${crypto.randomUUID()}/assignments`,
      { sessionToken: adminToken },
    );
    expect(res.status).toBe(404);
  });

  it("includes the referee's call on the dispute detail", async () => {
    const { assignment, dispute, refereeProfile } = await disputedMatchWithDecision(
      BetOutcome.PLAYER_B_WIN,
    );

    const res = await callApi("GET", `/api/admin/disputes/${dispute.id}`, {
      sessionToken: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.refereeAssignment.id).toBe(assignment.id);
    expect(res.body.refereeAssignment.decision).toBe(BetOutcome.PLAYER_B_WIN);
    expect(res.body.refereeAssignment.refereeProfile.id).toBe(refereeProfile.id);
  });
});

describe("Referee operations: capacity and quality", () => {
  it("reports coverage the admin view depends on", async () => {
    await disputedMatchWithDecision(BetOutcome.PLAYER_A_WIN);

    const capacity = await getRefereeCapacity();
    expect(capacity.approved).toBeGreaterThan(0);
    expect(capacity.available).toBeGreaterThan(0);
    expect(capacity.windowDays).toBe(7);
    expect(capacity.unclaimed).toBeGreaterThanOrEqual(0);
  });

  it("withholds an overturn rate below the sample threshold", async () => {
    const { refereeProfile, dispute } = await disputedMatchWithDecision(
      BetOutcome.PLAYER_A_WIN,
    );
    await callApi("PATCH", `/api/admin/disputes/${dispute.id}`, {
      sessionToken: adminToken,
      body: { status: "RESOLVED_PLAYER_B", resolution: "Overturned" },
    });

    const performance = await getRefereePerformance();
    const row = performance.find(
      (entry) => entry.refereeProfileId === refereeProfile.id,
    );

    expect(row).toBeDefined();
    expect(row!.decisionsSubmitted).toBe(1);
    expect(row!.overturned).toBe(1);
    // One decision must not surface as a 100% overturn rate.
    expect(row!.overturnRate).toBeNull();
    expect(MIN_DECISIONS_FOR_RATE).toBeGreaterThan(1);
    // Timing is still reported.
    expect(row!.medianDecisionSeconds).toBe(120);
  });
});
