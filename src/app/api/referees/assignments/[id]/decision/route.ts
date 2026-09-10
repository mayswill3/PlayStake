import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, errorResponse } from "@/lib/errors";
import { auditContextFromRequest } from "@/lib/referees/audit";
import { submitRefereeDecision } from "@/lib/referees/service";
import { refereeActionRateLimit } from "@/lib/middleware/rate-limit";
import { validateBody } from "@/lib/middleware/validate";
import { refereeDecisionSchema } from "@/lib/validation/schemas";

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
    const input = validateBody(refereeDecisionSchema, body);
    const { id } = await params;
    return NextResponse.json(
      await submitRefereeDecision({
        userId: session.userId,
        assignmentId: id,
        decision: input.decision,
        notes: input.notes,
        context: auditContextFromRequest(request),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
