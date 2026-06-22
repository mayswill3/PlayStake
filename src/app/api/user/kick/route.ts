import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index";
import {
  getValidAccessToken,
  listWebhookSubscriptions,
  deleteWebhookSubscriptions,
} from "../../../../lib/kick/api";

/**
 * Return the current user's Kick connection status.
 *
 * Never exposes the stored tokens — only the public-facing channel/profile
 * fields the dashboard needs to render the connection card.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const account = await prisma.kickAccount.findUnique({
      where: { userId: session.userId },
      select: {
        channelSlug: true,
        displayName: true,
        profilePicture: true,
        isLive: true,
        lastLiveAt: true,
        createdAt: true,
      },
    });

    if (!account) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      channelSlug: account.channelSlug,
      displayName: account.displayName,
      profilePicture: account.profilePicture,
      isLive: account.isLive,
      lastLiveAt: account.lastLiveAt?.toISOString() ?? null,
      connectedAt: account.createdAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Unlink the current user's Kick account.
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const account = await prisma.kickAccount.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ connected: false });
    }

    // Best-effort: revoke our webhook subscriptions before dropping the tokens.
    try {
      const accessToken = await getValidAccessToken(account.id);
      const subs = await listWebhookSubscriptions(accessToken);
      await deleteWebhookSubscriptions(
        accessToken,
        subs.map((s) => s.id),
      );
    } catch (subErr) {
      console.error("Kick webhook unsubscribe failed:", subErr);
    }

    await prisma.kickAccount
      .delete({ where: { userId: session.userId } })
      .catch(() => {
        // Already disconnected — treat as success.
      });

    return NextResponse.json({ connected: false });
  } catch (error) {
    return errorResponse(error);
  }
}
