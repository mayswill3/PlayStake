import { NextRequest, NextResponse } from "next/server";
import { prisma, withTransaction } from "../../../../../lib/db/client";
import { exchangeCodeForTokens, getGoogleUserInfo } from "../../../../../lib/auth/google";
import { createSession } from "../../../../../lib/auth/session";
import { sessionCookieValue } from "../../../../../lib/auth/helpers";
import { getOrCreatePlayerAccount } from "../../../../../lib/ledger/accounts";
import { getClientIp } from "../../../../../lib/middleware/rate-limit";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // User denied consent or other Google error
    if (error) {
      return NextResponse.redirect(`${appUrl}/login?error=google_denied`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${appUrl}/login?error=google_invalid`);
    }

    // Validate CSRF state
    const storedState = request.cookies.get("oauth_state")?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${appUrl}/login?error=google_invalid`);
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    const googleUser = getGoogleUserInfo(tokens.id_token);

    if (!googleUser.email_verified) {
      return NextResponse.redirect(`${appUrl}/login?error=google_unverified`);
    }

    // Account resolution: find or create user
    let userId: string;

    // 1. Check for existing OAuth link
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: "google",
          providerUserId: googleUser.sub,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      // Existing Google-linked user — log them in
      if (existingOAuth.user.deletedAt !== null) {
        return NextResponse.redirect(`${appUrl}/login?error=account_deleted`);
      }
      userId = existingOAuth.userId;
    } else {
      // 2. Check for existing user by email (auto-link)
      const existingUser = await prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (existingUser) {
        if (existingUser.deletedAt !== null) {
          return NextResponse.redirect(`${appUrl}/login?error=account_deleted`);
        }
        // Link Google account to existing user
        await prisma.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: "google",
            providerUserId: googleUser.sub,
            email: googleUser.email,
          },
        });
        userId = existingUser.id;
      } else {
        // 3. Create new user
        const newUser = await withTransaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: googleUser.email,
              passwordHash: null,
              displayName: googleUser.name,
              avatarUrl: googleUser.picture ?? null,
              emailVerified: true,
            },
          });

          await tx.oAuthAccount.create({
            data: {
              userId: user.id,
              provider: "google",
              providerUserId: googleUser.sub,
              email: googleUser.email,
            },
          });

          await getOrCreatePlayerAccount(tx, user.id);

          return user;
        });

        userId = newUser.id;
      }
    }

    // Update last login
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    // Create session (same as email/password login)
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const { sessionToken, expiresAt } = await createSession(userId, ip, userAgent);

    const response = NextResponse.redirect(`${appUrl}/dashboard`);
    response.headers.append("Set-Cookie", sessionCookieValue(sessionToken, expiresAt));

    // Clear the OAuth state cookie
    response.cookies.set("oauth_state", "", {
      httpOnly: true,
      secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https"),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/login?error=google_failed`);
  }
}
