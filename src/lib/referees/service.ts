import {
  BetMatchType,
  BetOutcome,
  BetStatus,
  KycStatus,
  RefereeAssignmentStatus,
  RefereeProfileStatus,
  type Prisma,
} from "../../../generated/prisma/client";
import { prisma, withTransaction, type TxClient } from "@/lib/db/client";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { appendRefereeAudit, type AuditContext } from "./audit";

export const REFEREE_DISPUTE_WINDOW_MS = 15 * 60 * 1000;

const activeAssignmentStatuses = [
  RefereeAssignmentStatus.ASSIGNED,
  RefereeAssignmentStatus.READY,
  RefereeAssignmentStatus.IN_PROGRESS,
] as const;

export async function getRefereeProfile(userId: string) {
  const [profile, games, account] = await Promise.all([
    prisma.refereeProfile.findUnique({
      where: { userId },
      include: {
        qualifications: { include: { game: { select: { id: true, name: true } } } },
      },
    }),
    prisma.game.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        kycStatus: true,
        kickAccount: { select: { channelSlug: true } },
      },
    }),
  ]);

  return {
    profile,
    games,
    requirements: {
      kickConnected: Boolean(account.kickAccount?.channelSlug),
      kycVerified: account.kycStatus === KycStatus.VERIFIED,
    },
  };
}

export async function applyToReferee(input: {
  userId: string;
  bio?: string;
  gameIds: string[];
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { kickAccount: { select: { channelSlug: true } } },
  });
  if (!user?.kickAccount?.channelSlug) {
    throw new ValidationError("Connect a Kick account before applying to referee");
  }
  if (input.bio && input.bio.length > 500) {
    throw new ValidationError("Bio must be 500 characters or fewer");
  }
  if (input.gameIds.length === 0) {
    throw new ValidationError("Select at least one game you can referee");
  }

  const validGames = await prisma.game.findMany({
    where: { id: { in: [...new Set(input.gameIds)] }, isActive: true },
    select: { id: true },
  });
  if (validGames.length !== new Set(input.gameIds).size) {
    throw new ValidationError("One or more selected games are unavailable");
  }

  return prisma.$transaction(async (tx) => {
    const profile = await tx.refereeProfile.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        bio: input.bio?.trim() || null,
      },
      update: {
        bio: input.bio?.trim() || null,
        // Any qualification change requires a fresh administrator review.
        status: RefereeProfileStatus.PENDING,
        isAvailable: false,
        approvedAt: null,
      },
    });
    await tx.refereeQualification.deleteMany({
      where: { refereeProfileId: profile.id },
    });
    await tx.refereeQualification.createMany({
      data: validGames.map((game) => ({
        refereeProfileId: profile.id,
        gameId: game.id,
      })),
      skipDuplicates: true,
    });
    return profile;
  });
}

export async function setRefereeAvailability(userId: string, isAvailable: boolean) {
  const profile = await prisma.refereeProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          kycStatus: true,
          kickAccount: { select: { channelSlug: true } },
        },
      },
    },
  });
  if (!profile) throw new NotFoundError("Referee application not found");
  if (profile.status !== RefereeProfileStatus.APPROVED) {
    throw new AuthorizationError("Your referee application must be approved first");
  }
  if (profile.user.kycStatus !== KycStatus.VERIFIED) {
    throw new AuthorizationError("Identity verification is required to referee");
  }
  if (!profile.user.kickAccount?.channelSlug) {
    throw new AuthorizationError("A connected Kick account is required to referee");
  }

  return prisma.refereeProfile.update({
    where: { id: profile.id },
    data: { isAvailable },
  });
}

const assignmentInclude = {
  bet: {
    include: {
      game: { select: { id: true, name: true } },
      playerA: {
        select: {
          id: true,
          displayName: true,
          kickAccount: {
            select: { channelSlug: true, isLive: true, declaredGameId: true },
          },
        },
      },
      playerB: {
        select: {
          id: true,
          displayName: true,
          kickAccount: {
            select: { channelSlug: true, isLive: true, declaredGameId: true },
          },
        },
      },
    },
  },
  refereeProfile: {
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          kickAccount: { select: { channelSlug: true } },
        },
      },
    },
  },
} satisfies Prisma.RefereeAssignmentInclude;

export async function listRefereeAssignments(userId: string, scope: string) {
  if (scope === "player") {
    return prisma.refereeAssignment.findMany({
      where: {
        bet: { OR: [{ playerAId: userId }, { playerBId: userId }] },
        status: {
          notIn: [RefereeAssignmentStatus.CANCELLED, RefereeAssignmentStatus.COMPLETED],
        },
      },
      include: assignmentInclude,
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  const profile = await prisma.refereeProfile.findUnique({
    where: { userId },
    include: { qualifications: { select: { gameId: true } } },
  });
  if (!profile) throw new AuthorizationError("Apply to become a referee first");

  if (scope === "mine") {
    return prisma.refereeAssignment.findMany({
      where: { refereeProfileId: profile.id },
      include: assignmentInclude,
      orderBy: { createdAt: "desc" },
      take: 25,
    });
  }

  if (
    profile.status !== RefereeProfileStatus.APPROVED ||
    !profile.isAvailable
  ) {
    return [];
  }

  const gameIds = profile.qualifications.map((item) => item.gameId);
  const candidates = await prisma.refereeAssignment.findMany({
    where: {
      status: RefereeAssignmentStatus.OPEN,
      bet: {
        gameId: { in: gameIds },
        status: BetStatus.MATCHED,
        playerAId: { not: userId },
        playerBId: { not: userId },
      },
    },
    include: assignmentInclude,
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  return candidates.filter(isAssignmentStillEligible);
}

function isAssignmentStillEligible(
  assignment: Prisma.RefereeAssignmentGetPayload<{ include: typeof assignmentInclude }>,
) {
  const { playerA, playerB, gameId } = assignment.bet;
  return Boolean(
    playerA.kickAccount?.isLive &&
      playerB?.kickAccount?.isLive &&
      playerA.kickAccount.declaredGameId === gameId &&
      playerB.kickAccount.declaredGameId === gameId,
  );
}

export async function claimAssignment(
  userId: string,
  assignmentId: string,
  context?: AuditContext,
) {
  return withTransaction(async (tx) => {
    const profile = await tx.refereeProfile.findUnique({
      where: { userId },
      include: {
        qualifications: { select: { gameId: true } },
        user: {
          select: {
            kycStatus: true,
            kickAccount: { select: { channelSlug: true } },
          },
        },
      },
    });
    if (!profile || profile.status !== RefereeProfileStatus.APPROVED) {
      throw new AuthorizationError("Only approved referees can claim matches");
    }
    if (!profile.isAvailable) throw new ConflictError("Set yourself available first");
    if (
      profile.user.kycStatus !== KycStatus.VERIFIED ||
      !profile.user.kickAccount?.channelSlug
    ) {
      throw new AuthorizationError("KYC and a connected Kick account are required");
    }

    const rows: Array<{ status: RefereeAssignmentStatus }> = await tx.$queryRaw`
      SELECT status FROM referee_assignments
      WHERE id = ${assignmentId}::uuid
      FOR UPDATE
    `;
    if (!rows[0]) throw new NotFoundError("Referee assignment not found");
    if (rows[0].status !== RefereeAssignmentStatus.OPEN) {
      throw new ConflictError("This match has already been claimed");
    }

    const assignment = await tx.refereeAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
    if (
      assignment.bet.playerAId === userId ||
      assignment.bet.playerBId === userId
    ) {
      throw new AuthorizationError("Players cannot referee their own match");
    }
    if (!profile.qualifications.some((item) => item.gameId === assignment.bet.gameId)) {
      throw new AuthorizationError("You are not qualified for this game");
    }
    if (!isAssignmentStillEligible(assignment)) {
      throw new ConflictError("Both players must still be live on the same declared game");
    }

    const conflicting = await tx.refereeAssignment.count({
      where: {
        refereeProfileId: profile.id,
        status: { in: [...activeAssignmentStatuses] },
      },
    });
    if (conflicting > 0) throw new ConflictError("You already have an active match");

    const updated = await tx.refereeAssignment.update({
      where: { id: assignmentId },
      data: {
        refereeProfileId: profile.id,
        status: RefereeAssignmentStatus.ASSIGNED,
        claimedAt: new Date(),
        version: { increment: 1 },
      },
      include: assignmentInclude,
    });
    await appendRefereeAudit(tx, {
      assignmentId,
      actorUserId: userId,
      action: "REFEREE_CLAIMED",
      details: { version: updated.version },
      context,
    });
    return updated;
  });
}

export async function advanceAssignment(
  userId: string,
  assignmentId: string,
  action: "READY" | "START",
  context?: AuditContext,
) {
  return withTransaction(async (tx) => {
    const assignment = await getOwnedAssignmentForUpdate(tx, userId, assignmentId);
    const expected =
      action === "READY"
        ? RefereeAssignmentStatus.ASSIGNED
        : RefereeAssignmentStatus.READY;
    if (assignment.status !== expected) {
      throw new ConflictError(`Assignment must be ${expected} before ${action.toLowerCase()}`);
    }
    const liveCheck = await tx.refereeAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        bet: {
          include: {
            playerA: {
              select: {
                kickAccount: {
                  select: { isLive: true, declaredGameId: true },
                },
              },
            },
            playerB: {
              select: {
                kickAccount: {
                  select: { isLive: true, declaredGameId: true },
                },
              },
            },
          },
        },
      },
    });
    if (
      !liveCheck.bet.playerA.kickAccount?.isLive ||
      !liveCheck.bet.playerB?.kickAccount?.isLive ||
      liveCheck.bet.playerA.kickAccount.declaredGameId !== liveCheck.bet.gameId ||
      liveCheck.bet.playerB.kickAccount.declaredGameId !== liveCheck.bet.gameId
    ) {
      throw new ConflictError(
        "Both players must be live on Kick with the assigned game",
      );
    }

    const now = new Date();
    const updated = await tx.refereeAssignment.update({
      where: { id: assignmentId },
      data:
        action === "READY"
          ? {
              status: RefereeAssignmentStatus.READY,
              readyAt: now,
              version: { increment: 1 },
            }
          : {
              status: RefereeAssignmentStatus.IN_PROGRESS,
              startedAt: now,
              version: { increment: 1 },
            },
    });
    await appendRefereeAudit(tx, {
      assignmentId,
      actorUserId: userId,
      action: action === "READY" ? "REFEREE_READY" : "MATCH_STARTED",
      details: { version: updated.version },
      context,
    });
    return updated;
  });
}

export async function submitRefereeDecision(input: {
  userId: string;
  assignmentId: string;
  decision: BetOutcome;
  notes: string;
  context?: AuditContext;
}) {
  if (!Object.values(BetOutcome).includes(input.decision)) {
    throw new ValidationError("Decision must select player A, player B, or draw");
  }
  const notes = input.notes.trim();
  if (notes.length < 10 || notes.length > 2000) {
    throw new ValidationError("Decision notes must be between 10 and 2,000 characters");
  }

  return withTransaction(async (tx) => {
    const assignment = await getOwnedAssignmentForUpdate(
      tx,
      input.userId,
      input.assignmentId,
    );
    if (assignment.status !== RefereeAssignmentStatus.IN_PROGRESS) {
      throw new ConflictError("The match must be in progress before a decision");
    }
    const bet = await tx.bet.findUniqueOrThrow({ where: { id: assignment.betId } });
    if (bet.status !== BetStatus.MATCHED) {
      throw new ConflictError(`Bet is ${bet.status} and cannot receive a decision`);
    }

    const now = new Date();
    const disputeDeadline = new Date(now.getTime() + REFEREE_DISPUTE_WINDOW_MS);
    const evidence = {
      notes,
      submittedAt: now.toISOString(),
      source: "human_referee",
    };
    const updated = await tx.refereeAssignment.update({
      where: { id: input.assignmentId },
      data: {
        status: RefereeAssignmentStatus.DECISION_SUBMITTED,
        decision: input.decision,
        evidence,
        decisionSubmittedAt: now,
        disputeDeadline,
        version: { increment: 1 },
      },
    });
    await tx.bet.update({
      where: { id: bet.id },
      data: {
        status: BetStatus.RESULT_REPORTED,
        outcome: input.decision,
        resultVerified: true,
        resultReportedAt: now,
        resultIdempotencyKey: `referee:${input.assignmentId}:v${updated.version}`,
        resultPayload: evidence,
      },
    });
    await appendRefereeAudit(tx, {
      assignmentId: input.assignmentId,
      actorUserId: input.userId,
      action: "DECISION_SUBMITTED",
      details: {
        decision: input.decision,
        notes,
        disputeDeadline: disputeDeadline.toISOString(),
        version: updated.version,
      },
      context: input.context,
    });
    return updated;
  });
}

async function getOwnedAssignmentForUpdate(
  tx: TxClient,
  userId: string,
  assignmentId: string,
) {
  await tx.$queryRaw`
    SELECT id FROM referee_assignments
    WHERE id = ${assignmentId}::uuid
    FOR UPDATE
  `;
  const assignment = await tx.refereeAssignment.findUnique({
    where: { id: assignmentId },
    include: { refereeProfile: { select: { userId: true } } },
  });
  if (!assignment) throw new NotFoundError("Referee assignment not found");
  if (assignment.refereeProfile?.userId !== userId) {
    throw new AuthorizationError("This assignment belongs to another referee");
  }
  return assignment;
}

export async function createRefereeAssignmentForBet(
  tx: TxClient,
  input: { betId: string; actorUserId: string },
) {
  const assignment = await tx.refereeAssignment.create({
    data: { betId: input.betId },
  });
  await appendRefereeAudit(tx, {
    assignmentId: assignment.id,
    actorUserId: input.actorUserId,
    action: "ASSIGNMENT_OPENED",
    details: {
      betId: input.betId,
      rewardPolicy: "10_PERCENT_OF_PLATFORM_FEE",
    },
  });
  return assignment;
}
