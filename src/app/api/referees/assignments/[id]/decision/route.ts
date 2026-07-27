import { NextRequest, NextResponse } from "next/server";
import { BetOutcome } from "@/../generated/prisma/client";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors";
import { auditContextFromRequest } from "@/lib/referees/audit";
import { submitRefereeDecision } from "@/lib/referees/service";
import { refereeActionRateLimit } from "@/lib/middleware/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limited = refereeActionRateLimit(request);
    if (limited) return limited;
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");
    const body = await request.json().catch(() => ({}));
    if (!Object.values(BetOutcome).includes(body.decision)) {
      throw new ValidationError("Invalid decision");
    }
    if (typeof body.notes !== "string") {
      throw new ValidationError("Decision notes are required");
    }
    const { id } = await params;
    return NextResponse.json(
      await submitRefereeDecision({
        userId: session.userId,
        assignmentId: id,
        decision: body.decision,
        notes: body.notes,
        context: auditContextFromRequest(request),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
