import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/client";
import { exchangeCodeForTokens } from "../../../../../lib/auth/kick";
import {
  fetchKickChannel,
  fetchKickUser,
  subscribeToWebhookEvents,
} from "../../../../../lib/kick/api";
import { validateSession } from "../../../../../lib/auth/session";
import { encrypt } from "../../../../../lib/utils/encryption";

const isSecure = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https");

function clearOAuthCookies(response: NextResponse) {
  for (const name of ["kick_oauth_state", "kick_oauth_verifier"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(`${appUrl}/dashboard?kick=denied`);
    }
    if (!code || !state) {
      return NextResponse.redirect(`${appUrl}/dashboard?kick=invalid`);
    }

    const storedState = request.cookies.get("kick_oauth_state")?.value;
    const codeVerifier = request.cookies.get("kick_oauth_verifier")?.value;
    if (!storedState || storedState !== state || !codeVerifier) {
      return NextResponse.redirect(`${appUrl}/dashboard?kick=invalid`);
    }

    // Kick linking is account-linking, not sign-in — the user must already
    // be authenticated in PlayStake.
    const sessionToken = request.cookies.get("playstake_session")?.value;
    const session = sessionToken ? await validateSession(sessionToken) : null;
    if (!session) {
      return NextResponse.redirect(`${appUrl}/login?next=/dashboard`);
    }

    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const kickUser = await fetchKickUser(tokens.access_token);
    const kickChannel = await fetchKickChannel(tokens.access_token);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const kickUserId = String(kickUser.user_id);

    // Guard: prevent linking a Kick identity that's already attached to a
    // different PlayStake user. Race-safe via the unique constraint, but we
    // surface a friendlier error if we detect it up front.
    const existing = await prisma.kickAccount.findUnique({
      where: { kickUserId },
    });
    if (existing && existing.userId !== session.userId) {
      const response = NextResponse.redirect(
        `${appUrl}/dashboard?kick=already_linked`,
      );
      clearOAuthCookies(response);
      return response;
    }

    await prisma.kickAccount.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        kickUserId,
        channelSlug: kickChannel?.slug ?? null,
        email: kickUser.email ?? null,
        displayName: kickUser.name,
        profilePicture: kickUser.profile_picture ?? null,
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        scope: tokens.scope,
      },
      update: {
        kickUserId,
        channelSlug: kickChannel?.slug ?? null,
        email: kickUser.email ?? null,
        displayName: kickUser.name,
        profilePicture: kickUser.profile_picture ?? null,
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        scope: tokens.scope,
      },
    });

    // Best-effort: register webhook subscriptions so we receive live/follow/sub
    // events. Non-fatal — the link still succeeds if this fails (e.g. the app
    // isn't yet verified for an event), and it can be retried on re-link.
    try {
      await subscribeToWebhookEvents(tokens.access_token);
    } catch (subErr) {
      console.error("Kick webhook subscription failed:", subErr);
    }

    const response = NextResponse.redirect(`${appUrl}/dashboard?kick=linked`);
    clearOAuthCookies(response);
    return response;
  } catch (err) {
    console.error("Kick OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/dashboard?kick=failed`);
  }
}
