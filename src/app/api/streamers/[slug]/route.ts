import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { fetchPublicChannels } from "../../../../lib/kick/api";
import { dollarsToCents } from "../../../../lib/utils/money";
import {
  errorResponse,
  AuthenticationError,
  NotFoundError,
} from "../../../../lib/errors/index";

export const dynamic = "force-dynamic";

// Bets we surface on a streamer's page: waiting for an opponent (OPEN) plus a
// match in progress (MATCHED / RESULT_REPORTED). Kept in sync with the "live"
// pill mapping used across the app.
const ACTIVE_BET_STATUSES = ["OPEN", "MATCHED", "RESULT_REPORTED"] as const;

/**
 * Public-facing streamer page data: live stream details + that streamer's
 * active PlayStake bets.
 *
 * "Who this is" and their bets come from our DB (a bet involves the streamer
 * when they are playerA or playerB). Live details (viewer count, thumbnail,
 * title) are best-effort enriched via Kick's public channels API.
 *
 * Only public-safe bet fields are returned — no balances, outcomes, or
 * net-result figures for the participants.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const { slug } = await params;

    const account = await prisma.kickAccount.findFirst({
      where: { channelSlug: slug },
      select: {
        userId: true,
        channelSlug: true,
        displayName: true,
        profilePicture: true,
        isLive: true,
      },
    });
    if (!account || !account.channelSlug) {
      throw new NotFoundError("Streamer not found");
    }

    // Best-effort live enrichment. If it fails, fall back to our DB flag.
    let isLive = account.isLive;
    let viewerCount: number | null = null;
    let thumbnail: string | null = null;
    let title: string | null = null;
    try {
      const [channel] = await fetchPublicChannels([account.channelSlug]);
      if (channel) {
        isLive = channel.stream?.is_live ?? false;
        viewerCount = channel.stream?.viewer_count ?? null;
        thumbnail = channel.stream?.thumbnail || null;
        title = channel.stream_title || null;
      }
    } catch (err) {
      console.error("Kick streamer enrichment failed:", err);
    }

    const bets = await prisma.bet.findMany({
      where: {
        status: { in: [...ACTIVE_BET_STATUSES] },
        OR: [{ playerAId: account.userId }, { playerBId: account.userId }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        game: { select: { id: true, name: true } },
        playerA: { select: { id: true, displayName: true } },
        playerB: { select: { id: true, displayName: true } },
      },
    });

    // Public-safe projection only.
    const activeBets = bets.map((bet) => ({
      id: bet.id,
      gameName: bet.game.name,
      playerAName: bet.playerA.displayName,
      playerBName: bet.playerB?.displayName ?? null,
      amount: dollarsToCents(bet.amount),
      status: bet.status,
      createdAt: bet.createdAt.toISOString(),
    }));

    return NextResponse.json({
      streamer: {
        channelSlug: account.channelSlug,
        displayName: account.displayName,
        profilePicture: account.profilePicture,
        isLive,
        viewerCount,
        thumbnail,
        title,
      },
      bets: activeBets,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
