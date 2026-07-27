import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, errorResponse } from "@/lib/errors";
import { auditContextFromRequest } from "@/lib/referees/audit";
import { claimAssignment } from "@/lib/referees/service";
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
    const { id } = await params;
    return NextResponse.json(
      await claimAssignment(session.userId, id, auditContextFromRequest(request)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
