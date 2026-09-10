// =============================================================================
// Integration Tests: Referee assignment lifecycle
// =============================================================================
// The claim must be first-wins under real concurrency, and the TTL sweep must
// only ever act on stale state: a live claim, an active match, or a fresh
// assignment racing the sweep always wins. These run against the real database
// (committed, cleaned up in afterAll) because the guarantees under test are
// row locks and transaction boundaries.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import {
  BetStatus,
  KycStatus,
  RefereeAssignmentStatus,
  RefereeProfileStatus,
} from "../../generated/prisma/client.js";
import { withTransaction } from "../../src/lib/db/client.js";
import {
  claimAssignment,
  sweepRefereeAssignment,
  REFEREE_CLAIM_TTL_MS,
  REFEREE_START_TTL_MS,
  REFEREE_MATCH_TTL_MS,
} from "../../src/lib/referees/service.js";
import { ConflictError } from "../../src/lib/errors/index.js";

const prisma = getTestPrisma();
let gameId: string;

beforeAll(async () => {
  const devUser = await prisma.user.create({
    data: {
      email: "ref-life-dev@playstake-test.com",
      role: "DEVELOPER",
      displayName: "Ref Life Dev",
      emailVerified: true,
    },
  });
  const profile = await prisma.developerProfile.create({
    data: {
      userId: devUser.id,
      companyName: "Ref Life Co",
      contactEmail: "ref-life-dev@playstake-test.com",
    },
  });
  const game = await prisma.game.create({
    data: {
      developerProfileId: profile.id,
      name: "Ref Life Game",
      slug: "ref-life-game",
      platformFeePercent: new Decimal("0.05"),
    },
  });
  gameId = game.id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { contains: "ref-life-" } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  const bets = await prisma.bet.findMany({
    where: { OR: [{ gameId }, { playerAId: { in: userIds } }] },
    select: { id: true },
  });
  const betIds = bets.map((bet) => bet.id);

  // The audit table's append-only trigger is suspended just long enough to
  // remove this suite's rows — same pattern as referee-operations.test.ts.
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
  await prisma.bet.deleteMany({ where: { id: { in: betIds } } });
  await prisma.refereeQualification.deleteMany({
    where: { refereeProfile: { userId: { in: userIds } } },
  });
  await prisma.refereeProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.kickAccount.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.developerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectTestPrisma();
});

async function makeUser(displayName: string, kycVerified = false) {
  const uid = crypto.randomUUID().substring(0, 8);
  return prisma.user.create({
    data: {
      email: `ref-life-${uid}@playstake-test.com`,
      displayName,
      emailVerified: true,
      ...(kycVerified ? { kycStatus: KycStatus.VERIFIED } : {}),
    },
  });
}

async function attachKickAccount(userId: string, live: boolean) {
  const uid = crypto.randomUUID().substring(0, 12);
  return prisma.kickAccount.create({
    data: {
      userId,
      kickUserId: `ref-life-${uid}`,
      channelSlug: `ref-life-${uid}`,
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: "user:read",
      isLive: live,
      declaredGameId: live ? gameId : null,
    },
  });
}

/** An approved, available, KYC-verified, Kick-connected, game-qualified referee. */
async function makeReferee(name: string) {
  const user = await makeUser(name, true);
  await attachKickAccount(user.id, false);
  const profile = await prisma.refereeProfile.create({
    data: {
      userId: user.id,
      status: RefereeProfileStatus.APPROVED,
      isAvailable: true,
      approvedAt: new Date(),
      qualifications: { create: { gameId } },
    },
  });
  return { user, profile };
}

/** A MATCHED bet between two live streamers with an OPEN referee assignment. */
async function makeClaimableMatch() {
  const playerA = await makeUser("Ref Life A");
  const playerB = await makeUser("Ref Life B");
  await attachKickAccount(playerA.id, true);
  await attachKickAccount(playerB.id, true);

  const bet = await prisma.bet.create({
    data: {
      gameId,
      playerAId: playerA.id,
      playerBId: playerB.id,
      amount: new Decimal("5.00"),
      status: BetStatus.MATCHED,
      platformFeePercent: new Decimal("0.05"),
      expiresAt: new Date(Date.now() + 3_600_000),
      matchedAt: new Date(),
    },
  });
  const assignment = await prisma.refereeAssignment.create({
    data: { betId: bet.id },
  });
  return { bet, assignment, playerA, playerB };
}

/** Backdate a timestamp column past its TTL; raw SQL because Prisma manages updated_at. */
async function backdate(
  assignmentId: string,
  column: "updated_at" | "claimed_at" | "ready_at" | "started_at",
  ms: number,
) {
  const past = new Date(Date.now() - ms - 1_000);
  await prisma.$executeRawUnsafe(
    `UPDATE referee_assignments SET ${column} = $1 WHERE id = $2::uuid`,
    past,
    assignmentId,
  );
}

const sweep = (assignmentId: string) =>
  withTransaction((tx) => sweepRefereeAssignment(tx, assignmentId));

describe("Referee lifecycle: claiming", () => {
  it("exactly one of two concurrent claims wins", async () => {
    const { assignment } = await makeClaimableMatch();
    const ref1 = await makeReferee("Ref Life R1");
    const ref2 = await makeReferee("Ref Life R2");

    const results = await Promise.allSettled([
      claimAssignment(ref1.user.id, assignment.id),
      claimAssignment(ref2.user.id, assignment.id),
    ]);

    const wins = results.filter((r) => r.status === "fulfilled");
    const losses = results.filter((r) => r.status === "rejected");
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect((losses[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const claimed = await prisma.refereeAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(claimed.status).toBe(RefereeAssignmentStatus.ASSIGNED);
    expect([ref1.profile.id, ref2.profile.id]).toContain(claimed.refereeProfileId);
  });
});

describe("Referee lifecycle: TTL sweep", () => {
  it("voids and cancels an assignment nobody claimed within the TTL", async () => {
    const { bet, assignment } = await makeClaimableMatch();
    await backdate(assignment.id, "updated_at", REFEREE_CLAIM_TTL_MS);

    expect(await sweep(assignment.id)).toBe("expired_unclaimed");

    const after = await prisma.refereeAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(after.status).toBe(RefereeAssignmentStatus.CANCELLED);
    const voidedBet = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(voidedBet.status).toBe(BetStatus.VOIDED);
  });

  it("leaves a fresh OPEN assignment alone", async () => {
    const { bet, assignment } = await makeClaimableMatch();
    expect(await sweep(assignment.id)).toBeNull();
    expect(
      (await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } })).status,
    ).toBe(BetStatus.MATCHED);
  });

  it("releases a stalled claim back to the pool without touching the bet", async () => {
    const { bet, assignment } = await makeClaimableMatch();
    const referee = await makeReferee("Ref Life Staller");
    await claimAssignment(referee.user.id, assignment.id);
    await backdate(assignment.id, "claimed_at", REFEREE_START_TTL_MS);

    expect(await sweep(assignment.id)).toBe("released_stalled");

    const after = await prisma.refereeAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(after.status).toBe(RefereeAssignmentStatus.OPEN);
    expect(after.refereeProfileId).toBeNull();
    expect(after.claimedAt).toBeNull();
    expect(
      (await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } })).status,
    ).toBe(BetStatus.MATCHED);

    const audit = await prisma.refereeAuditEvent.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { sequence: "asc" },
    });
    expect(audit.map((event) => event.action)).toContain("ASSIGNMENT_RELEASED");

    // The release restarted the claim window, so the OPEN rule must not fire
    // immediately on the next scan.
    expect(await sweep(assignment.id)).toBeNull();
  });

  it("does not release a recently claimed assignment", async () => {
    const { assignment } = await makeClaimableMatch();
    const referee = await makeReferee("Ref Life Fresh");
    await claimAssignment(referee.user.id, assignment.id);

    expect(await sweep(assignment.id)).toBeNull();
    const after = await prisma.refereeAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(after.status).toBe(RefereeAssignmentStatus.ASSIGNED);
    expect(after.refereeProfileId).not.toBeNull();
  });

  it("voids a match that has run past the in-progress ceiling", async () => {
    const { bet, assignment } = await makeClaimableMatch();
    const referee = await makeReferee("Ref Life Marathon");
    await prisma.refereeAssignment.update({
      where: { id: assignment.id },
      data: {
        status: RefereeAssignmentStatus.IN_PROGRESS,
        refereeProfileId: referee.profile.id,
        claimedAt: new Date(),
        readyAt: new Date(),
        startedAt: new Date(),
      },
    });
    await backdate(assignment.id, "started_at", REFEREE_MATCH_TTL_MS);

    expect(await sweep(assignment.id)).toBe("voided_overrun");

    const after = await prisma.refereeAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(after.status).toBe(RefereeAssignmentStatus.CANCELLED);
    expect(
      (await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } })).status,
    ).toBe(BetStatus.VOIDED);

    // The formerly-stuck referee can claim again: the phantom-assignment
    // lockout is exactly what cancellation-on-void exists to prevent.
    const next = await makeClaimableMatch();
    const claimed = await claimAssignment(referee.user.id, next.assignment.id);
    expect(claimed.status).toBe(RefereeAssignmentStatus.ASSIGNED);
  });
});
