import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/client";
import { BetStatus } from "../../../../../../generated/prisma/client";
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

    // Check within 24 hours of result reporting
    if (bet.resultReportedAt) {
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

    // Create the dispute
    const dispute = await prisma.dispute.create({
      data: {
        betId,
        filedById: session.userId,
        reason: input.reason,
      },
    });

    // Update bet status to DISPUTED if it was RESULT_REPORTED
    if (bet.status === BetStatus.RESULT_REPORTED) {
      await prisma.bet.update({
        where: { id: betId },
        data: { status: BetStatus.DISPUTED },
      });
    }

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
