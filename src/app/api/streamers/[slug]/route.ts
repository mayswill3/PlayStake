import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { fetchPublicChannels } from "../../../../lib/kick/api";
import { dollarsToCents } from "../../../../lib/utils/money";
import {
  isRefereedStreamGame,
  streamGameTypeForSlug,
} from "../../../../lib/games/catalogue";
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
        declaredGame: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!account || !account.channelSlug) {
      throw new NotFoundError("Streamer not found");
    }

    // Map the stored Game row into the supported stream-game vocabulary.
    const declaredGameType = account.declaredGame
      ? streamGameTypeForSlug(account.declaredGame.slug)
      : null;
    const declaredGame =
      account.declaredGame && declaredGameType
        ? { gameType: declaredGameType, name: account.declaredGame.name }
        : null;

    // Whether the viewer is looking at their own channel (used to hide the
    // Challenge button — you can't challenge yourself).
    const isSelf = session.userId === account.userId;

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

    const [bets, viewerKick] = await Promise.all([
      prisma.bet.findMany({
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
        refereeAssignment: {
          include: {
            refereeProfile: {
              include: {
                user: {
                  select: {
                    displayName: true,
                    kickAccount: { select: { channelSlug: true } },
                  },
                },
              },
            },
          },
        },
      },
      }),
      prisma.kickAccount.findUnique({
        where: { userId: session.userId },
        select: { isLive: true, declaredGameId: true },
      }),
    ]);

    // Public-safe projection only.
    const activeBets = bets.map((bet) => ({
      id: bet.id,
      gameName: bet.game.name,
      playerAName: bet.playerA.displayName,
      playerBName: bet.playerB?.displayName ?? null,
      amount: dollarsToCents(bet.amount),
      status: bet.status,
      createdAt: bet.createdAt.toISOString(),
      referee: bet.refereeAssignment?.refereeProfile
        ? {
            displayName: bet.refereeAssignment.refereeProfile.user.displayName,
            kickChannel:
              bet.refereeAssignment.refereeProfile.user.kickAccount?.channelSlug ??
              null,
            status: bet.refereeAssignment.status,
          }
        : null,
    }));

    const streamVsStreamEligible = Boolean(
      !isSelf &&
        isLive &&
        account.declaredGame &&
        viewerKick?.isLive &&
        viewerKick.declaredGameId &&
        viewerKick.declaredGameId === account.declaredGame.id,
    );
    const selectedGameRequiresReferee = declaredGameType
      ? isRefereedStreamGame(declaredGameType)
      : false;

    return NextResponse.json({
      streamer: {
        channelSlug: account.channelSlug,
        displayName: account.displayName,
        profilePicture: account.profilePicture,
        isLive,
        viewerCount,
        thumbnail,
        title,
        declaredGame,
        isSelf,
        canChallenge:
          !isSelf &&
          Boolean(isLive && declaredGame) &&
          (viewerKick?.isLive
            ? streamVsStreamEligible
            : !selectedGameRequiresReferee),
        streamVsStreamEligible,
        selectedGameRequiresReferee,
      },
      bets: activeBets,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
