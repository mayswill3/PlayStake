import { NextRequest, NextResponse } from "next/server";
import {
  generateOAuthState,
  generatePkceVerifier,
  getKickAuthUrl,
} from "../../../../lib/auth/kick";
import { validateSession } from "../../../../lib/auth/session";

const isSecure = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https");

// Kick linking requires a logged-in PlayStake user. Unlike Google (which doubles
// as a sign-in provider), Kick is account-linking: we need to know which
// PlayStake user the channel belongs to before kicking off the OAuth dance.
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const sessionToken = request.cookies.get("playstake_session")?.value;
  const session = sessionToken ? await validateSession(sessionToken) : null;
  if (!session) {
    return NextResponse.redirect(`${appUrl}/login?next=/api/auth/kick`);
  }

  const state = generateOAuthState();
  const codeVerifier = generatePkceVerifier();
  const authUrl = getKickAuthUrl(state, codeVerifier);

  const response = NextResponse.redirect(authUrl);

  response.cookies.set("kick_oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  response.cookies.set("kick_oauth_verifier", codeVerifier, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
