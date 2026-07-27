import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors";
import { listRefereeAssignments } from "@/lib/referees/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");
    const scope = request.nextUrl.searchParams.get("scope") ?? "available";
    if (!["available", "mine", "player"].includes(scope)) {
      throw new ValidationError("scope must be available, mine, or player");
    }
    return NextResponse.json({
      assignments: await listRefereeAssignments(session.userId, scope),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
