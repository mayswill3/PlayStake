import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "../../../../lib/auth/session.js";
import { getSessionToken, clearSessionCookieValue } from "../../../../lib/auth/helpers.js";
import { errorResponse } from "../../../../lib/errors/index.js";

export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);

    if (token) {
      await destroySession(token);
    }

    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", clearSessionCookieValue());

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
