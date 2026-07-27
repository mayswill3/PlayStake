import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  errorResponse,
} from "@/lib/errors";
import { verifyRefereeAuditChain } from "@/lib/referees/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");
    const { id } = await params;
    const assignment = await prisma.refereeAssignment.findUnique({
      where: { id },
      include: {
        bet: { select: { playerAId: true, playerBId: true } },
        refereeProfile: { select: { userId: true } },
        auditEvents: { orderBy: { sequence: "asc" } },
      },
    });
    if (!assignment) throw new NotFoundError("Assignment not found");
    const canView =
      session.user.role === "ADMIN" ||
      assignment.bet.playerAId === session.userId ||
      assignment.bet.playerBId === session.userId ||
      assignment.refereeProfile?.userId === session.userId;
    if (!canView) throw new AuthorizationError();

    return NextResponse.json({
      integrityVerified: verifyRefereeAuditChain(assignment.auditEvents),
      events: assignment.auditEvents.map((event) => ({
        sequence: event.sequence,
        action: event.action,
        details: event.details,
        createdAt: event.createdAt,
        eventHash: event.eventHash,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
