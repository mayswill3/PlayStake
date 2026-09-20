import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { dollarsToCents } from "../../../../lib/utils/money";
import { REFEREE_CLAIM_TTL_MS } from "../../../../lib/referees/service";
import {
  errorResponse,
  AuthenticationError,
  NotFoundError,
  AuthorizationError,
} from "../../../../lib/errors/index";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const { id } = await params;

    const bet = await prisma.bet.findUnique({
      where: { id },
      include: {
        game: { select: { id: true, name: true, logoUrl: true } },
        playerA: {
          select: {
            id: true,
            displayName: true,
            kickAccount: { select: { channelSlug: true, isLive: true } },
          },
        },
        playerB: {
          select: {
            id: true,
            displayName: true,
            kickAccount: { select: { channelSlug: true, isLive: true } },
          },
        },
        refereeAssignment: {
          include: {
            refereeProfile: {
              include: {
                user: {
                  select: {
                    displayName: true,
                    kickAccount: { select: { channelSlug: true, isLive: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!bet) {
      throw new NotFoundError("Bet not found");
    }

    // Verify user is a participant
    if (
      bet.playerAId !== session.userId &&
      bet.playerBId !== session.userId
    ) {
      throw new AuthorizationError("You are not a participant in this bet");
    }

    // Which side the caller is on, so the client can offer a rematch without
    // having to work out who "the other player" is for itself.
    const opponentRecord =
      bet.playerAId === session.userId ? bet.playerB : bet.playerA;

    return NextResponse.json({
      id: bet.id,
      externalId: bet.externalId,
      opponent: opponentRecord
        ? {
            id: opponentRecord.id,
            displayName: opponentRecord.displayName,
            kick: opponentRecord.kickAccount?.channelSlug
              ? {
                  channelSlug: opponentRecord.kickAccount.channelSlug,
                  isLive: opponentRecord.kickAccount.isLive,
                }
              : null,
          }
        : null,
      game: {
        id: bet.game.id,
        name: bet.game.name,
        logoUrl: bet.game.logoUrl,
      },
      playerA: {
        id: bet.playerA.id,
        displayName: bet.playerA.displayName,
        kick: bet.playerA.kickAccount?.channelSlug
          ? {
              channelSlug: bet.playerA.kickAccount.channelSlug,
              isLive: bet.playerA.kickAccount.isLive,
            }
          : null,
      },
      playerB: bet.playerB
        ? {
            id: bet.playerB.id,
            displayName: bet.playerB.displayName,
            kick: bet.playerB.kickAccount?.channelSlug
              ? {
                  channelSlug: bet.playerB.kickAccount.channelSlug,
                  isLive: bet.playerB.kickAccount.isLive,
                }
              : null,
          }
        : null,
      amount: dollarsToCents(bet.amount),
      currency: bet.currency,
      status: bet.status,
      matchType: bet.matchType,
      outcome: bet.outcome,
      // The widget gates its result-confirmation UI on these two, so they have
      // to survive the trip even though the dashboard doesn't read them.
      resultVerified: bet.resultVerified,
      expiresAt: bet.expiresAt.toISOString(),
      platformFeeAmount: bet.platformFeeAmount
        ? dollarsToCents(bet.platformFeeAmount)
        : null,
      gameMetadata: bet.gameMetadata,
      resultPayload: bet.resultPayload,
      createdAt: bet.createdAt.toISOString(),
      matchedAt: bet.matchedAt?.toISOString() ?? null,
      resultReportedAt: bet.resultReportedAt?.toISOString() ?? null,
      settledAt: bet.settledAt?.toISOString() ?? null,
      refereeAssignment: bet.refereeAssignment
        ? {
            id: bet.refereeAssignment.id,
            status: bet.refereeAssignment.status,
            decision: bet.refereeAssignment.decision,
            disputeDeadline:
              bet.refereeAssignment.disputeDeadline?.toISOString() ?? null,
            // The claim window: when an unclaimed assignment is voided and
            // refunded by the bet-expiry sweep — anchored on updatedAt exactly
            // as sweepRefereeAssignment does (a released match restarts it).
            claimOpenedAt:
              bet.refereeAssignment.status === "OPEN"
                ? bet.refereeAssignment.updatedAt.toISOString()
                : null,
            claimDeadline:
              bet.refereeAssignment.status === "OPEN"
                ? new Date(
                    bet.refereeAssignment.updatedAt.getTime() +
                      REFEREE_CLAIM_TTL_MS,
                  ).toISOString()
                : null,
            rewardPolicy: "10% of the platform fee",
            referee: bet.refereeAssignment.refereeProfile
              ? {
                  displayName:
                    bet.refereeAssignment.refereeProfile.user.displayName,
                  kickChannel:
                    bet.refereeAssignment.refereeProfile.user.kickAccount
                      ?.channelSlug ?? null,
                  kickLive:
                    bet.refereeAssignment.refereeProfile.user.kickAccount
                      ?.isLive ?? false,
                }
              : null,
          }
        : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
