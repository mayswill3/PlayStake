import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, errorResponse } from "@/lib/errors";
import {
  applyToReferee,
  getRefereeProfile,
  setRefereeAvailability,
} from "@/lib/referees/service";
import { refereeActionRateLimit } from "@/lib/middleware/rate-limit";
import { validateBody } from "@/lib/middleware/validate";
import {
  refereeApplySchema,
  refereeAvailabilitySchema,
} from "@/lib/validation/schemas";

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
    const input = validateBody(refereeApplySchema, body);
    const profile = await applyToReferee({
      userId: session.userId,
      bio: input.bio,
      gameIds: input.gameIds,
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
    const input = validateBody(refereeAvailabilitySchema, body);
    return NextResponse.json(
      await setRefereeAvailability(session.userId, input.isAvailable),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
