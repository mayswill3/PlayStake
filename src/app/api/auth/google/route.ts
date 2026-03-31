import { NextResponse } from "next/server";
import { generateOAuthState, getGoogleAuthUrl } from "../../../../lib/auth/google";

const isSecure = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https");

export async function GET() {
  const state = generateOAuthState();
  const authUrl = getGoogleAuthUrl(state);

  const response = NextResponse.redirect(authUrl);

  // Store state in a short-lived httpOnly cookie for CSRF validation
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}
