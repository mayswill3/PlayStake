import {
  BetMatchType,
  BetStatus,
  RefereeAssignmentStatus,
  type BetOutcome,
  type Prisma,
} from "../../../generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { fetchPublicChannels } from "@/lib/kick/api";
import { dollarsToCents } from "@/lib/utils/money";
import { LIVE_PHASES, spectatorPhase, type SpectatorPhase } from "./phase";

// Spectator view of refereed stream matches (STREAM_VS_STREAM bets) for users
// who aren't playing in them. Only stream matches are exposed — both players
// broadcast them publicly on Kick. Private lobby bets never appear here.

export type { SpectatorPhase };

export interface SpectatorParticipant {
  displayName: string;
  channelSlug: string | null;
  isLive: boolean;
  profilePicture: string | null;
  /** Kick's live thumbnail — list endpoint only, when Kick's API answers. */
  thumbnail: string | null;
  /** Kick's live viewer count — list endpoint only, when Kick's API answers. */
  viewerCount: number | null;
}

export interface SpectatorMatch {
  betId: string;
  gameName: string;
  phase: SpectatorPhase;
  /** Both stakes combined, in cents. */
  potCents: number;
  playerA: SpectatorParticipant;
  playerB: SpectatorParticipant | null;
  referee: SpectatorParticipant | null;
  outcome: BetOutcome | null;
  matchedAt: string | null;
}

const ACTIVE_ASSIGNMENT_STATUSES = [
  RefereeAssignmentStatus.OPEN,
  RefereeAssignmentStatus.ASSIGNED,
  RefereeAssignmentStatus.READY,
  RefereeAssignmentStatus.IN_PROGRESS,
  RefereeAssignmentStatus.DECISION_SUBMITTED,
];

const participantSelect = {
  displayName: true,
  kickAccount: { select: { channelSlug: true, isLive: true, profilePicture: true } },
} satisfies Prisma.UserSelect;

const spectatorInclude = {
  game: { select: { name: true } },
  playerA: { select: participantSelect },
  playerB: { select: participantSelect },
  refereeAssignment: {
    select: {
      status: true,
      refereeProfile: { select: { user: { select: participantSelect } } },
    },
  },
} satisfies Prisma.BetInclude;

type SpectatorBetRow = Prisma.BetGetPayload<{ include: typeof spectatorInclude }>;
type ParticipantRow = Prisma.UserGetPayload<{ select: typeof participantSelect }>;

/** Live stats per lower-cased Kick channel slug, from Kick's public API. */
type ChannelStats = Map<string, { thumbnail: string | null; viewerCount: number | null }>;

function toParticipant(user: ParticipantRow, stats: ChannelStats): SpectatorParticipant {
  const slug = user.kickAccount?.channelSlug ?? null;
  const live = slug ? stats.get(slug.toLowerCase()) : undefined;
  return {
    displayName: user.displayName,
    channelSlug: slug,
    isLive: user.kickAccount?.isLive ?? false,
    profilePicture: user.kickAccount?.profilePicture ?? null,
    thumbnail: live?.thumbnail ?? null,
    viewerCount: live?.viewerCount ?? null,
  };
}

function toSpectatorMatch(bet: SpectatorBetRow, stats: ChannelStats = new Map()): SpectatorMatch {
  const refereeUser = bet.refereeAssignment?.refereeProfile?.user ?? null;
  return {
    betId: bet.id,
    gameName: bet.game.name,
    phase: spectatorPhase(bet.status, bet.refereeAssignment?.status ?? null),
    potCents: dollarsToCents(bet.amount) * 2,
    playerA: toParticipant(bet.playerA, stats),
    playerB: bet.playerB ? toParticipant(bet.playerB, stats) : null,
    referee: refereeUser ? toParticipant(refereeUser, stats) : null,
    outcome: bet.outcome,
    matchedAt: bet.matchedAt?.toISOString() ?? null,
  };
}

/**
 * Refereed stream matches in progress, most exciting first (live before
 * starting before finding a referee). Enriched with Kick live thumbnails and
 * viewer counts when Kick's public API is reachable; the list still works
 * without them.
 */
export async function listLiveMatches(limit = 12): Promise<SpectatorMatch[]> {
  const bets = await prisma.bet.findMany({
    where: {
      matchType: BetMatchType.STREAM_VS_STREAM,
      status: { in: [BetStatus.MATCHED, BetStatus.RESULT_REPORTED] },
      refereeAssignment: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
    },
    include: spectatorInclude,
    orderBy: { matchedAt: "desc" },
    take: limit,
  });

  const slugs = new Set<string>();
  for (const bet of bets) {
    for (const user of [bet.playerA, bet.playerB, bet.refereeAssignment?.refereeProfile?.user]) {
      if (user?.kickAccount?.channelSlug) slugs.add(user.kickAccount.channelSlug);
    }
  }
  const stats: ChannelStats = new Map();
  if (slugs.size > 0) {
    try {
      for (const channel of await fetchPublicChannels([...slugs])) {
        if (!channel.stream?.is_live) continue;
        stats.set(channel.slug.toLowerCase(), {
          // Kick returns "" until the live thumbnail is generated; treat as none.
          thumbnail: channel.stream.thumbnail || null,
          viewerCount: channel.stream.viewer_count ?? null,
        });
      }
    } catch (err) {
      console.error("Live match enrichment failed:", err);
    }
  }

  return bets
    .map((bet) => toSpectatorMatch(bet, stats))
    .filter((match) => LIVE_PHASES.includes(match.phase))
    .sort((a, b) => LIVE_PHASES.indexOf(a.phase) - LIVE_PHASES.indexOf(b.phase));
}

/** Everyone watching a match: both players' streams plus the referee cam. */
export function matchViewerCount(match: SpectatorMatch): number {
  return [match.playerA, match.playerB, match.referee].reduce(
    (total, participant) => total + (participant?.viewerCount ?? 0),
    0,
  );
}

/**
 * The match to feature on the homepage: the in-progress (LIVE) match with the
 * most viewers. Matches still starting or finding a referee don't qualify.
 */
export function pickFeaturedMatch(matches: SpectatorMatch[]): SpectatorMatch | null {
  let best: SpectatorMatch | null = null;
  for (const match of matches) {
    if (match.phase !== "LIVE") continue;
    if (!best || matchViewerCount(match) > matchViewerCount(best)) best = match;
  }
  return best;
}

/** One refereed stream match for the spectator page, in any phase. */
export async function getSpectatorMatch(betId: string): Promise<SpectatorMatch | null> {
  const bet = await prisma.bet.findFirst({
    where: { id: betId, matchType: BetMatchType.STREAM_VS_STREAM },
    include: spectatorInclude,
  });
  return bet ? toSpectatorMatch(bet) : null;
}
