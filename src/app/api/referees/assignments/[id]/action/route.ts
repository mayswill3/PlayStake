import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors";
import { auditContextFromRequest } from "@/lib/referees/audit";
import { advanceAssignment } from "@/lib/referees/service";
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
    if (body.action !== "READY" && body.action !== "START") {
      throw new ValidationError("action must be READY or START");
    }
    const { id } = await params;
    return NextResponse.json(
      await advanceAssignment(
        session.userId,
        id,
        body.action,
        auditContextFromRequest(request),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
