import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/client";
import {
  BetStatus,
  RefereeAssignmentStatus,
} from "../../../../../../generated/prisma/client";
import { validateSession } from "../../../../../lib/auth/session";
import { getSessionToken } from "../../../../../lib/auth/helpers";
import { disputeSchema } from "../../../../../lib/validation/schemas";
import { validateBody } from "../../../../../lib/middleware/validate";
import {
  errorResponse,
  AuthenticationError,
  NotFoundError,
  AuthorizationError,
  AppError,
  ConflictError,
} from "../../../../../lib/errors/index";
import {
  appendRefereeAudit,
  auditContextFromRequest,
} from "@/lib/referees/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const { id: betId } = await params;

    const body = await request.json();
    const input = validateBody(disputeSchema, body);

    // Fetch the bet
    const bet = await prisma.bet.findUnique({
      where: { id: betId },
    });

    if (!bet) {
      throw new NotFoundError("Bet not found");
    }

    // Verify user is a participant
    if (
      bet.playerAId !== session.userId &&
      bet.playerBId !== session.userId
    ) {
      throw new AuthorizationError("You are not a participant in this bet");
    }

    // Check bet is in a disputable state
    const disputableStatuses: string[] = [
      BetStatus.RESULT_REPORTED,
      BetStatus.SETTLED,
    ];
    if (!disputableStatuses.includes(bet.status)) {
      throw new AppError(
        `Bet is not in a disputable state. Current status: ${bet.status}`,
        400,
        "BET_NOT_DISPUTABLE"
      );
    }

    const refereeAssignment = await prisma.refereeAssignment.findUnique({
      where: { betId },
    });

    // Refereed stream matches use the deadline shown to both players. Other
    // bets retain the existing 24-hour policy.
    if (refereeAssignment?.disputeDeadline) {
      if (refereeAssignment.disputeDeadline <= new Date()) {
        throw new AppError(
          "The referee dispute window has closed.",
          400,
          "DISPUTE_WINDOW_CLOSED",
        );
      }
    } else if (bet.resultReportedAt) {
      const hoursElapsed =
        (Date.now() - bet.resultReportedAt.getTime()) / (1000 * 60 * 60);
      if (hoursElapsed > 24) {
        throw new AppError(
          "Dispute window has closed. Disputes must be filed within 24 hours of result reporting.",
          400,
          "DISPUTE_WINDOW_CLOSED"
        );
      }
    }

    // Check for existing dispute by this user
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        betId,
        filedById: session.userId,
      },
    });

    if (existingDispute) {
      throw new ConflictError(
        "You have already filed a dispute for this bet"
      );
    }

    const dispute = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM bets WHERE id = ${betId}::uuid FOR UPDATE
      `;
      const current = await tx.bet.findUniqueOrThrow({ where: { id: betId } });
      if (
        current.status !== BetStatus.RESULT_REPORTED &&
        current.status !== BetStatus.SETTLED
      ) {
        throw new ConflictError("This bet is no longer disputable");
      }

      const created = await tx.dispute.create({
        data: {
          betId,
          filedById: session.userId,
          reason: input.reason,
        },
      });
      if (current.status === BetStatus.RESULT_REPORTED) {
        await tx.bet.update({
          where: { id: betId },
          data: { status: BetStatus.DISPUTED },
        });
      }
      if (refereeAssignment) {
        await tx.refereeAssignment.update({
          where: { id: refereeAssignment.id },
          data: {
            status: RefereeAssignmentStatus.DISPUTED,
            version: { increment: 1 },
          },
        });
        await appendRefereeAudit(tx, {
          assignmentId: refereeAssignment.id,
          actorUserId: session.userId,
          action: "DISPUTE_FILED",
          details: { disputeId: created.id, reason: input.reason },
          context: auditContextFromRequest(request),
        });
      }
      return created;
    });

    return NextResponse.json(
      {
        disputeId: dispute.id,
        status: dispute.status,
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
