import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors";
import {
  applyToReferee,
  getRefereeProfile,
  setRefereeAvailability,
} from "@/lib/referees/service";
import { refereeActionRateLimit } from "@/lib/middleware/rate-limit";

async function authenticate(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) throw new AuthenticationError();
  const session = await validateSession(token);
  if (!session) throw new AuthenticationError("Invalid or expired session");
  return session;
}

export async function GET(request: NextRequest) {
  try {
    const session = await authenticate(request);
    return NextResponse.json(await getRefereeProfile(session.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = refereeActionRateLimit(request);
    if (limited) return limited;
    const session = await authenticate(request);
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.gameIds) || !body.gameIds.every((id: unknown) => typeof id === "string")) {
      throw new ValidationError("gameIds must be a list of game IDs");
    }
    const profile = await applyToReferee({
      userId: session.userId,
      bio: typeof body.bio === "string" ? body.bio : undefined,
      gameIds: body.gameIds,
    });
    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = refereeActionRateLimit(request);
    if (limited) return limited;
    const session = await authenticate(request);
    const body = await request.json().catch(() => ({}));
    if (typeof body.isAvailable !== "boolean") {
      throw new ValidationError("isAvailable must be a boolean");
    }
    return NextResponse.json(
      await setRefereeAvailability(session.userId, body.isAvailable),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
