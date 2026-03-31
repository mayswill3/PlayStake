import { NextResponse } from "next/server";
import { generateOAuthState, getGoogleAuthUrl } from "../../../../lib/auth/google";

export async function GET() {
  const state = generateOAuthState();
  const authUrl = getGoogleAuthUrl(state);

  const response = NextResponse.redirect(authUrl);

  // Store state in a short-lived httpOnly cookie for CSRF validation
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}
