// =============================================================================
// PlayStake — Lobby Service
// =============================================================================
// Core business logic for the matchmaking lobby. Kept separate from route
// handlers so the expiry worker and (future) tests can reuse it.
// =============================================================================

import { Decimal } from "@prisma/client/runtime/client";
import { prisma } from "@/lib/db/client";
import {
  LobbyRole,
  LobbyStatus,
  StreamChallengeStatus,
  BetStatus,
  LedgerAccountType,
} from "../../../generated/prisma/client";
import {
  AppError,
  AuthorizationError,
  ConflictError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors/index";
import { centsToDollars } from "@/lib/utils/money";
import { holdEscrow } from "@/lib/ledger/escrow";
import {
  isLobbyGameType,
  getDemoGameId,
  lobbyGameTypeForSlug,
  LOBBY_GAME_META,
  type LobbyGameType,
} from "./games";
import { LobbyChannels, publishLobbyEvent } from "./pubsub";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long a WAITING lobby entry lives before it expires. */
export const LOBBY_ENTRY_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** How long a Player B has to respond to an invite. */
export const LOBBY_INVITE_TTL_MS = 60 * 1000; // 60 seconds

/** How long a bet lives (matches the default in /api/v1/bets). */
const BET_TTL_MS = 30 * 60 * 1000;

/** How long Player A/B have to consent to the bet. */
const BET_CONSENT_TTL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// join
// ---------------------------------------------------------------------------

export interface JoinLobbyInput {
  userId: string;
  gameType: string;
  role: LobbyRole;
  stakeAmount: number; // cents
}

export interface JoinLobbyResult {
  lobbyEntryId: string;
  status: LobbyStatus;
  expiresAt: Date;
  position: number;
}

export async function joinLobby(input: JoinLobbyInput): Promise<JoinLobbyResult> {
  if (!isLobbyGameType(input.gameType)) {
    throw new ValidationError(`Unknown gameType: ${input.gameType}`);
  }
  if (input.role !== LobbyRole.PLAYER_A && input.role !== LobbyRole.PLAYER_B) {
    throw new ValidationError(`Invalid role: ${input.role}`);
  }
  if (input.role === LobbyRole.PLAYER_A) {
    if (!Number.isFinite(input.stakeAmount) || input.stakeAmount <= 0) {
      throw new ValidationError("stakeAmount must be a positive integer (cents) for Player A");
    }
  }

  const gameType = input.gameType as LobbyGameType;
  const now = new Date();

  // Idempotent: reuse an existing active entry for this user+game
  const existing = await prisma.lobbyEntry.findFirst({
    where: {
      userId: input.userId,
      gameType,
      status: { in: [LobbyStatus.WAITING, LobbyStatus.INVITED] },
      expiresAt: { gt: now },
    },
  });

  if (existing) {
    const position = await countWaitingOpponents(gameType, existing.role, existing.id);
    return {
      lobbyEntryId: existing.id,
      status: existing.status,
      expiresAt: existing.expiresAt,
      position,
    };
  }

  // Cancel any other active entries across different games for this user
  await prisma.lobbyEntry.updateMany({
    where: {
      userId: input.userId,
      status: { in: [LobbyStatus.WAITING, LobbyStatus.INVITED] },
    },
    data: { status: LobbyStatus.CANCELLED },
  });

  const expiresAt = new Date(now.getTime() + LOBBY_ENTRY_TTL_MS);

  const entry = await prisma.lobbyEntry.create({
    data: {
      gameType,
      userId: input.userId,
      role: input.role,
      stakeAmount: input.stakeAmount,
      status: LobbyStatus.WAITING,
      expiresAt,
    },
  });

  const position = await countWaitingOpponents(gameType, entry.role, entry.id);

  await publishLobbyEvent(LobbyChannels.game(gameType), {
    event: "PLAYER_JOINED",
    role: entry.role,
    lobbyEntryId: entry.id,
    userId: entry.userId,
  });

  return {
    lobbyEntryId: entry.id,
    status: entry.status,
    expiresAt: entry.expiresAt,
    position,
  };
}

async function countWaitingOpponents(
  gameType: LobbyGameType,
  myRole: LobbyRole,
  myEntryId: string
): Promise<number> {
  const oppositeRole =
    myRole === LobbyRole.PLAYER_A ? LobbyRole.PLAYER_B : LobbyRole.PLAYER_A;
  return prisma.lobbyEntry.count({
    where: {
      gameType,
      role: oppositeRole,
      status: LobbyStatus.WAITING,
      expiresAt: { gt: new Date() },
      id: { not: myEntryId },
    },
  });
}

// ---------------------------------------------------------------------------
// list players
// ---------------------------------------------------------------------------

export interface ListPlayersInput {
  callerUserId: string;
  gameType: string;
  role: LobbyRole; // role the CALLER wants to see (opposite of their own)
}

export interface LobbyPlayerDTO {
  lobbyEntryId: string;
  userId: string;
  displayName: string;
  avatarInitials: string;
  stakeAmount: number;
  waitingSince: string;
  status: "WAITING";
}

export interface ListPlayersResult {
  players: LobbyPlayerDTO[];
  totalWaiting: number;
}

export async function listLobbyPlayers(input: ListPlayersInput): Promise<ListPlayersResult> {
  if (!isLobbyGameType(input.gameType)) {
    throw new ValidationError(`Unknown gameType: ${input.gameType}`);
  }

  // Verify the caller is actually in this lobby with the opposite role.
  const callerRole =
    input.role === LobbyRole.PLAYER_A ? LobbyRole.PLAYER_B : LobbyRole.PLAYER_A;

  const callerEntry = await prisma.lobbyEntry.findFirst({
    where: {
      userId: input.callerUserId,
      gameType: input.gameType,
      role: callerRole,
      status: { in: [LobbyStatus.WAITING, LobbyStatus.INVITED] },
      expiresAt: { gt: new Date() },
    },
  });

  if (!callerEntry) {
    throw new AuthorizationError(
      "You must be in this lobby to see the opposite role's waiting list"
    );
  }

  const rows = await prisma.lobbyEntry.findMany({
    where: {
      gameType: input.gameType,
      role: input.role,
      status: LobbyStatus.WAITING,
      expiresAt: { gt: new Date() },
      userId: { not: input.callerUserId },
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, displayName: true } },
    },
    take: 50,
  });

  const players: LobbyPlayerDTO[] = rows.map((row) => ({
    lobbyEntryId: row.id,
    userId: row.userId,
    displayName: row.user.displayName ?? "Player",
    avatarInitials: computeInitials(row.user.displayName),
    stakeAmount: row.stakeAmount,
    waitingSince: row.createdAt.toISOString(),
    status: "WAITING" as const,
  }));

  return { players, totalWaiting: players.length };
}

function computeInitials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// invite
// ---------------------------------------------------------------------------

export interface InviteInput {
  callerUserId: string;
  lobbyEntryId: string; // caller's own entry (must be Player A)
  targetEntryId: string; // Player B's entry
}

export interface InviteResult {
  inviteId: string;
  status: "SENT";
  expiresAt: Date;
}

export async function inviteLobbyPlayer(input: InviteInput): Promise<InviteResult> {
  const now = new Date();
  const inviteExpiresAt = new Date(now.getTime() + LOBBY_INVITE_TTL_MS);

  const result = await prisma.$transaction(async (tx) => {
    const caller = await tx.lobbyEntry.findUnique({
      where: { id: input.lobbyEntryId },
    });
    if (!caller) throw new NotFoundError("Your lobby entry not found");
    if (caller.userId !== input.callerUserId) {
      throw new AuthorizationError("You don't own that lobby entry");
    }
    if (caller.role !== LobbyRole.PLAYER_A) {
      throw new ValidationError("Only Player A can send invites");
    }
    if (caller.status !== LobbyStatus.WAITING) {
      throw new ConflictError(`Your entry is ${caller.status}, cannot send invite`);
    }
    if (caller.expiresAt <= now) {
      throw new ConflictError("Your lobby entry has expired");
    }

    const target = await tx.lobbyEntry.findUnique({
      where: { id: input.targetEntryId },
      include: { user: { select: { id: true, displayName: true } } },
    });
    if (!target) throw new NotFoundError("Target player not found");
    if (target.gameType !== caller.gameType) {
      throw new ValidationError("Target is in a different game");
    }
    if (target.role !== LobbyRole.PLAYER_B) {
      throw new ValidationError("Target must be Player B");
    }
    if (target.status !== LobbyStatus.WAITING) {
      throw new ConflictError(`Target is ${target.status}, cannot invite`);
    }
    if (target.expiresAt <= now) {
      throw new ConflictError("Target entry has expired");
    }

    const updatedTarget = await tx.lobbyEntry.update({
      where: { id: target.id },
      data: {
        status: LobbyStatus.INVITED,
        invitedById: input.callerUserId,
        inviteExpiresAt,
      },
    });

    const inviter = await tx.user.findUnique({
      where: { id: input.callerUserId },
      select: { displayName: true },
    });

    return { caller, target: updatedTarget, inviterName: inviter?.displayName ?? "Player" };
  });

  // Fire pub/sub events after the transaction commits.
  await publishLobbyEvent(LobbyChannels.invite(result.target.userId), {
    event: "INVITE_RECEIVED",
    fromDisplayName: result.inviterName,
    fromUserId: input.callerUserId,
    fromLobbyEntryId: result.caller.id,
    stakeAmount: result.caller.stakeAmount,
    gameType: result.caller.gameType,
    lobbyEntryId: result.target.id,
    inviteExpiresAt: inviteExpiresAt.toISOString(),
  });

  await publishLobbyEvent(LobbyChannels.game(result.caller.gameType), {
    event: "PLAYER_INVITED",
    targetEntryId: result.target.id,
  });

  return {
    inviteId: result.target.id,
    status: "SENT",
    expiresAt: inviteExpiresAt,
  };
}

// ---------------------------------------------------------------------------
// challenge (viewer -> streamer)
// ---------------------------------------------------------------------------

export interface CreateChallengeInput {
  /** The authenticated viewer issuing the challenge (becomes Player A). */
  challengerUserId: string;
  /** The streamer's Kick channel slug (from the stream page URL). */
  streamerChannelSlug: string;
  /** Stake the viewer is putting up, in cents. Both sides lock this amount. */
  stakeAmount: number;
}

export interface CreateChallengeResult {
  challengeId: string;
  /** The viewer's own (Player A) lobby entry. */
  challengerLobbyEntryId: string;
  /** The streamer's (Player B) invited entry — what they accept via /respond. */
  streamerLobbyEntryId: string;
  streamerUserId: string;
  gameType: LobbyGameType;
  stakeAmount: number;
  inviteExpiresAt: Date;
}

/**
 * A viewer challenges a live streamer to a wager for the game the streamer has
 * declared. This is a targeted lobby invite: the viewer becomes a WAITING
 * Player A holding the stake and the streamer becomes an INVITED Player B. The
 * streamer accepts through the existing `/api/lobby/respond` (respondToInvite),
 * which is where escrow actually happens.
 *
 * IMPORTANT: this creates NO bet and touches the ledger in NO way. Funds are
 * only locked when the challenged streamer consents via the accept path.
 *
 * The game is resolved server-side from the streamer's declared game — the
 * caller supplies only the stake amount.
 */
export async function createChallenge(
  input: CreateChallengeInput
): Promise<CreateChallengeResult> {
  // Validate the stake up front (pure, no DB) so bad input fails fast.
  if (!Number.isInteger(input.stakeAmount) || input.stakeAmount <= 0) {
    throw new ValidationError("stakeAmount must be a positive integer (cents)");
  }

  // Resolve the streamer from their Kick channel. Live status + declared game
  // both live on the KickAccount, so this is a single lookup.
  const account = await prisma.kickAccount.findFirst({
    where: { channelSlug: input.streamerChannelSlug },
    select: {
      userId: true,
      isLive: true,
      declaredGame: { select: { slug: true } },
    },
  });
  if (!account) {
    throw new NotFoundError("Streamer not found");
  }
  if (account.userId === input.challengerUserId) {
    throw new ValidationError("You can't challenge yourself");
  }
  if (!account.isLive) {
    throw new ConflictError("This streamer is not live right now");
  }
  if (!account.declaredGame) {
    throw new ValidationError("This streamer hasn't declared a game to challenge");
  }
  const gameType = lobbyGameTypeForSlug(account.declaredGame.slug);
  if (!gameType) {
    // Declared game isn't one of the challengeable lobby games.
    throw new ValidationError("This streamer's game can't be challenged");
  }

  const streamerUserId = account.userId;

  // Soft, non-authoritative balance check: don't publish a challenge the viewer
  // can't fund, so the shortfall surfaces on the challenger here rather than on
  // the streamer when they accept. Read the balance exactly the way
  // wallet/balance does — the materialized PLAYER_BALANCE row, in dollars.
  // This is NOT a lock and creates no account: holdEscrow at accept remains the
  // sole authoritative gate (and a concurrent spend can still make accept fail).
  const challengerAccount = await prisma.ledgerAccount.findUnique({
    where: {
      userId_accountType: {
        userId: input.challengerUserId,
        accountType: LedgerAccountType.PLAYER_BALANCE,
      },
    },
    select: { balance: true },
  });
  const availableDollars = challengerAccount
    ? new Decimal(challengerAccount.balance.toString())
    : new Decimal(0);
  if (availableDollars.lt(centsToDollars(input.stakeAmount))) {
    throw new InsufficientFundsError(
      "You don't have enough balance to stake this challenge",
    );
  }

  const now = new Date();
  const inviteExpiresAt = new Date(now.getTime() + LOBBY_INVITE_TTL_MS);
  const expiresAt = new Date(now.getTime() + LOBBY_ENTRY_TTL_MS);

  // Idempotent reuse: return the exact paired entries for an existing pending
  // challenge instead of reconstructing the relationship from lobby fields.
  const existingChallenge = await prisma.streamChallenge.findFirst({
    where: {
      challengerUserId: input.challengerUserId,
      streamerUserId,
      gameType,
      status: StreamChallengeStatus.PENDING,
      expiresAt: { gt: now },
    },
  });
  if (existingChallenge) {
    return {
      challengeId: existingChallenge.id,
      challengerLobbyEntryId: existingChallenge.challengerLobbyEntryId,
      streamerLobbyEntryId: existingChallenge.streamerLobbyEntryId,
      streamerUserId,
      gameType,
      stakeAmount: existingChallenge.stakeAmount,
      inviteExpiresAt: existingChallenge.expiresAt,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    // A viewer can have only one active outgoing stream challenge. Supersede
    // any older one and cancel its exact paired lobby entries.
    const superseded = await tx.streamChallenge.findMany({
      where: {
        challengerUserId: input.challengerUserId,
        status: StreamChallengeStatus.PENDING,
      },
      select: {
        id: true,
        streamerUserId: true,
        challengerLobbyEntryId: true,
        streamerLobbyEntryId: true,
      },
    });
    if (superseded.length > 0) {
      await tx.streamChallenge.updateMany({
        where: { id: { in: superseded.map((challenge) => challenge.id) } },
        data: { status: StreamChallengeStatus.CANCELLED, respondedAt: now },
      });
      await tx.lobbyEntry.updateMany({
        where: {
          id: {
            in: superseded.flatMap((challenge) => [
              challenge.challengerLobbyEntryId,
              challenge.streamerLobbyEntryId,
            ]),
          },
        },
        data: { status: LobbyStatus.CANCELLED },
      });
    }

    // One active lobby entry per user: clear the viewer's other entries first
    // (same invariant joinLobby enforces).
    await tx.lobbyEntry.updateMany({
      where: {
        userId: input.challengerUserId,
        status: { in: [LobbyStatus.WAITING, LobbyStatus.INVITED] },
      },
      data: { status: LobbyStatus.CANCELLED },
    });

    // Viewer = Player A, holds the stake, WAITING.
    const challengerEntry = await tx.lobbyEntry.create({
      data: {
        gameType,
        userId: input.challengerUserId,
        role: LobbyRole.PLAYER_A,
        stakeAmount: input.stakeAmount,
        status: LobbyStatus.WAITING,
        expiresAt,
      },
    });

    // Streamer = Player B, INVITED. No bet, no escrow — respondToInvite does
    // that when the streamer accepts.
    const streamerEntry = await tx.lobbyEntry.create({
      data: {
        gameType,
        userId: streamerUserId,
        role: LobbyRole.PLAYER_B,
        stakeAmount: input.stakeAmount,
        status: LobbyStatus.INVITED,
        invitedById: input.challengerUserId,
        inviteExpiresAt,
        expiresAt,
      },
    });

    const challenge = await tx.streamChallenge.create({
      data: {
        challengerUserId: input.challengerUserId,
        streamerUserId,
        gameType,
        stakeAmount: input.stakeAmount,
        challengerLobbyEntryId: challengerEntry.id,
        streamerLobbyEntryId: streamerEntry.id,
        expiresAt: inviteExpiresAt,
      },
    });

    const challenger = await tx.user.findUnique({
      where: { id: input.challengerUserId },
      select: { displayName: true },
    });

    return {
      challengerEntry,
      streamerEntry,
      challenge,
      challengerName: challenger?.displayName ?? "Player",
      supersededStreamerIds: superseded.map((item) => item.streamerUserId),
    };
  });

  for (const previousStreamerId of result.supersededStreamerIds) {
    await publishLobbyEvent(LobbyChannels.invite(previousStreamerId), {
      event: "CHALLENGE_CANCELLED",
    });
  }

  // Deliver the invite live to the streamer. Same channel + payload shape as
  // inviteLobbyPlayer so the existing invite UI and /api/lobby/respond flow
  // handle it unchanged.
  await publishLobbyEvent(LobbyChannels.invite(streamerUserId), {
    event: "INVITE_RECEIVED",
    fromDisplayName: result.challengerName,
    fromUserId: input.challengerUserId,
    fromLobbyEntryId: result.challengerEntry.id,
    stakeAmount: input.stakeAmount,
    gameType,
    lobbyEntryId: result.streamerEntry.id,
    inviteExpiresAt: inviteExpiresAt.toISOString(),
  });

  return {
    challengeId: result.challenge.id,
    challengerLobbyEntryId: result.challengerEntry.id,
    streamerLobbyEntryId: result.streamerEntry.id,
    streamerUserId,
    gameType,
    stakeAmount: input.stakeAmount,
    inviteExpiresAt,
  };
}

// ---------------------------------------------------------------------------
// respond to invite
// ---------------------------------------------------------------------------

export interface RespondInput {
  callerUserId: string;
  lobbyEntryId: string; // caller's own (Player B) entry
  response: "ACCEPT" | "DECLINE";
}

export type RespondResult =
  | { status: "MATCHED"; betId: string; gameType: LobbyGameType }
  | { status: "DECLINED" };

export async function respondToInvite(input: RespondInput): Promise<RespondResult> {
  const now = new Date();

  if (input.response === "DECLINE") {
    const entry = await prisma.lobbyEntry.findUnique({
      where: { id: input.lobbyEntryId },
    });
    if (!entry) throw new NotFoundError("Lobby entry not found");
    if (entry.userId !== input.callerUserId) {
      throw new AuthorizationError("You don't own that lobby entry");
    }
    if (entry.status !== LobbyStatus.INVITED) {
      throw new ConflictError(`Entry is ${entry.status}, cannot decline`);
    }

    const streamChallenge = await prisma.streamChallenge.findUnique({
      where: { streamerLobbyEntryId: entry.id },
    });
    const previousInviter = entry.invitedById;

    if (streamChallenge) {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.streamChallenge.updateMany({
          where: {
            id: streamChallenge.id,
            streamerUserId: input.callerUserId,
            status: StreamChallengeStatus.PENDING,
          },
          data: {
            status: StreamChallengeStatus.DECLINED,
            respondedAt: now,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictError("This challenge is no longer pending");
        }
        await tx.lobbyEntry.updateMany({
          where: {
            id: {
              in: [
                streamChallenge.challengerLobbyEntryId,
                streamChallenge.streamerLobbyEntryId,
              ],
            },
            status: { in: [LobbyStatus.WAITING, LobbyStatus.INVITED] },
          },
          data: { status: LobbyStatus.CANCELLED },
        });
      });
    } else {
      // Normal lobby invitations keep Player B in the public lobby.
      await prisma.lobbyEntry.update({
        where: { id: entry.id },
        data: {
          status: LobbyStatus.WAITING,
          invitedById: null,
          inviteExpiresAt: null,
        },
      });
    }

    if (previousInviter) {
      await publishLobbyEvent(LobbyChannels.inviteDeclined(previousInviter), {
        event: "INVITE_DECLINED",
        lobbyEntryId: entry.id,
      });
    }
    if (!streamChallenge) {
      await publishLobbyEvent(LobbyChannels.game(entry.gameType), {
        event: "PLAYER_JOINED",
        role: LobbyRole.PLAYER_B,
        lobbyEntryId: entry.id,
        userId: entry.userId,
      });
    }

    return { status: "DECLINED" };
  }

  // ACCEPT path — gather validation + fetch game id outside the tx so the
  // transaction stays tight and short.
  const entryPreview = await prisma.lobbyEntry.findUnique({
    where: { id: input.lobbyEntryId },
  });
  if (!entryPreview) throw new NotFoundError("Lobby entry not found");
  if (entryPreview.userId !== input.callerUserId) {
    throw new AuthorizationError("You don't own that lobby entry");
  }
  if (!isLobbyGameType(entryPreview.gameType)) {
    throw new ValidationError(`Unknown gameType: ${entryPreview.gameType}`);
  }
  const gameType = entryPreview.gameType as LobbyGameType;
  const resolvedGameId = await getDemoGameId(gameType);

  // Load game for platform fee / limits
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: resolvedGameId },
    select: { platformFeePercent: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const playerBEntry = await tx.lobbyEntry.findUnique({
      where: { id: input.lobbyEntryId },
    });
    if (!playerBEntry) throw new NotFoundError("Lobby entry not found");
    if (playerBEntry.status !== LobbyStatus.INVITED) {
      throw new ConflictError(`Entry is ${playerBEntry.status}, cannot accept`);
    }
    if (playerBEntry.inviteExpiresAt && playerBEntry.inviteExpiresAt <= now) {
      throw new ConflictError("Invite has expired");
    }
    if (!playerBEntry.invitedById) {
      throw new ConflictError("No pending invite on this entry");
    }

    const streamChallenge = await tx.streamChallenge.findUnique({
      where: { streamerLobbyEntryId: playerBEntry.id },
    });
    if (
      streamChallenge &&
      (streamChallenge.status !== StreamChallengeStatus.PENDING ||
        streamChallenge.expiresAt <= now)
    ) {
      throw new ConflictError("This challenge is no longer pending");
    }

    const playerAEntry = streamChallenge
      ? await tx.lobbyEntry.findUnique({
          where: { id: streamChallenge.challengerLobbyEntryId },
        })
      : await tx.lobbyEntry.findFirst({
          where: {
            userId: playerBEntry.invitedById,
            gameType: playerBEntry.gameType,
            role: LobbyRole.PLAYER_A,
            status: LobbyStatus.WAITING,
            expiresAt: { gt: now },
          },
        });
    if (!playerAEntry) {
      throw new ConflictError("Player A is no longer waiting");
    }
    if (
      playerAEntry.status !== LobbyStatus.WAITING ||
      playerAEntry.expiresAt <= now ||
      playerAEntry.userId !== playerBEntry.invitedById ||
      playerAEntry.gameType !== playerBEntry.gameType
    ) {
      throw new ConflictError("Player A is no longer waiting");
    }

    // Create the bet in PENDING_CONSENT as the starting point of the
    // lifecycle (for audit trail), then immediately run escrow holds for
    // both players in the same transaction. The lobby join + invite
    // acceptance flow is itself the explicit consent action, so we skip
    // the widget's "Confirm & Lock Funds" step entirely and deliver a
    // MATCHED bet to the client.
    const consentExpiresAt = new Date(now.getTime() + BET_CONSENT_TTL_MS);
    const expiresAt = new Date(now.getTime() + BET_TTL_MS);
    const amountDollars = centsToDollars(playerAEntry.stakeAmount);

    const bet = await tx.bet.create({
      data: {
        gameId: resolvedGameId,
        playerAId: playerAEntry.userId,
        playerBId: playerBEntry.userId,
        amount: amountDollars,
        currency: "USD",
        status: BetStatus.PENDING_CONSENT,
        platformFeePercent: game.platformFeePercent,
        gameMetadata: { gameType, source: "lobby" },
        consentExpiresAt,
        expiresAt,
      },
    });

    // Hold escrow for Player A — bet is currently PENDING_CONSENT which
    // holdEscrow accepts. This locks Player A's stake.
    await holdEscrow(tx, {
      playerId: playerAEntry.userId,
      betId: bet.id,
      amount: amountDollars,
      idempotencyKey: `lobby:consentA:${bet.id}`,
    });

    // Transition to OPEN so Player B's escrow hold passes the status guard.
    await tx.bet.update({
      where: { id: bet.id },
      data: {
        status: BetStatus.OPEN,
        playerAConsentedAt: now,
      },
    });

    // Hold escrow for Player B.
    await holdEscrow(tx, {
      playerId: playerBEntry.userId,
      betId: bet.id,
      amount: amountDollars,
      idempotencyKey: `lobby:consentB:${bet.id}`,
    });

    // Transition to MATCHED — both escrows are now locked and the bet is
    // ready for gameplay.
    await tx.bet.update({
      where: { id: bet.id },
      data: {
        status: BetStatus.MATCHED,
        playerBConsentedAt: now,
        matchedAt: now,
      },
    });

    await tx.lobbyEntry.update({
      where: { id: playerAEntry.id },
      data: {
        status: LobbyStatus.MATCHED,
        betId: bet.id,
      },
    });

    await tx.lobbyEntry.update({
      where: { id: playerBEntry.id },
      data: {
        status: LobbyStatus.MATCHED,
        betId: bet.id,
      },
    });

    if (streamChallenge) {
      const accepted = await tx.streamChallenge.updateMany({
        where: {
          id: streamChallenge.id,
          status: StreamChallengeStatus.PENDING,
        },
        data: {
          status: StreamChallengeStatus.ACCEPTED,
          betId: bet.id,
          respondedAt: now,
        },
      });
      if (accepted.count !== 1) {
        throw new ConflictError("This challenge is no longer pending");
      }
    }

    // A streamer can accept only one invitation at a time. Close every other
    // pending stream challenge and its exact lobby pair in this transaction.
    const competingChallenges = await tx.streamChallenge.findMany({
      where: {
        streamerUserId: playerBEntry.userId,
        status: StreamChallengeStatus.PENDING,
        ...(streamChallenge ? { id: { not: streamChallenge.id } } : {}),
      },
      select: {
        id: true,
        challengerUserId: true,
        challengerLobbyEntryId: true,
        streamerLobbyEntryId: true,
      },
    });
    if (competingChallenges.length > 0) {
      await tx.streamChallenge.updateMany({
        where: { id: { in: competingChallenges.map((challenge) => challenge.id) } },
        data: {
          status: StreamChallengeStatus.CANCELLED,
          respondedAt: now,
        },
      });
      await tx.lobbyEntry.updateMany({
        where: {
          id: {
            in: competingChallenges.flatMap((challenge) => [
              challenge.challengerLobbyEntryId,
              challenge.streamerLobbyEntryId,
            ]),
          },
          status: { in: [LobbyStatus.WAITING, LobbyStatus.INVITED] },
        },
        data: { status: LobbyStatus.CANCELLED },
      });
    }

    return {
      betId: bet.id,
      playerAUserId: playerAEntry.userId,
      playerBUserId: playerBEntry.userId,
      gameType,
      cancelledChallengerIds: competingChallenges.map(
        (challenge) => challenge.challengerUserId,
      ),
    };
  });

  for (const challengerUserId of result.cancelledChallengerIds) {
    await publishLobbyEvent(LobbyChannels.inviteDeclined(challengerUserId), {
      event: "CHALLENGE_CANCELLED",
    });
  }

  // Notify both sides so they can navigate into the game.
  await publishLobbyEvent(LobbyChannels.matched(result.playerAUserId), {
    event: "MATCH_CONFIRMED",
    betId: result.betId,
    gameType: result.gameType,
  });
  await publishLobbyEvent(LobbyChannels.matched(result.playerBUserId), {
    event: "MATCH_CONFIRMED",
    betId: result.betId,
    gameType: result.gameType,
  });

  return { status: "MATCHED", betId: result.betId, gameType: result.gameType };
}

// ---------------------------------------------------------------------------
// leave
// ---------------------------------------------------------------------------

export async function leaveLobby(callerUserId: string, lobbyEntryId: string): Promise<void> {
  const entry = await prisma.lobbyEntry.findUnique({ where: { id: lobbyEntryId } });
  if (!entry) throw new NotFoundError("Lobby entry not found");
  if (entry.userId !== callerUserId) {
    throw new AuthorizationError("You don't own that lobby entry");
  }
  if (entry.status === LobbyStatus.MATCHED) {
    throw new ConflictError("Cannot leave a matched lobby entry");
  }

  await prisma.lobbyEntry.update({
    where: { id: entry.id },
    data: { status: LobbyStatus.CANCELLED },
  });

  await publishLobbyEvent(LobbyChannels.game(entry.gameType), {
    event: "PLAYER_LEFT",
    lobbyEntryId: entry.id,
    role: entry.role,
  });
}

// ---------------------------------------------------------------------------
// status (polling fallback)
// ---------------------------------------------------------------------------

export interface LobbyStatusResult {
  lobbyEntryId: string;
  status: LobbyStatus;
  gameType: string;
  role: LobbyRole;
  betId: string | null;
  expiresAt: string;
  inviteExpiresAt: string | null;
  invitedBy: {
    userId: string;
    displayName: string;
    stakeAmount: number;
    gameType: string;
    fromLobbyEntryId: string;
  } | null;
}

export async function getLobbyStatus(
  callerUserId: string,
  lobbyEntryId: string
): Promise<LobbyStatusResult> {
  const entry = await prisma.lobbyEntry.findUnique({
    where: { id: lobbyEntryId },
  });
  if (!entry) throw new NotFoundError("Lobby entry not found");
  if (entry.userId !== callerUserId) {
    throw new AuthorizationError("You don't own that lobby entry");
  }

  let invitedBy: LobbyStatusResult["invitedBy"] = null;
  if (entry.status === LobbyStatus.INVITED && entry.invitedById) {
    const inviterUser = await prisma.user.findUnique({
      where: { id: entry.invitedById },
      select: { id: true, displayName: true },
    });
    const inviterEntry = await prisma.lobbyEntry.findFirst({
      where: {
        userId: entry.invitedById,
        gameType: entry.gameType,
        role: LobbyRole.PLAYER_A,
      },
      orderBy: { createdAt: "desc" },
    });
    if (inviterUser && inviterEntry) {
      invitedBy = {
        userId: inviterUser.id,
        displayName: inviterUser.displayName ?? "Player",
        stakeAmount: inviterEntry.stakeAmount,
        gameType: entry.gameType,
        fromLobbyEntryId: inviterEntry.id,
      };
    }
  }

  return {
    lobbyEntryId: entry.id,
    status: entry.status,
    gameType: entry.gameType,
    role: entry.role,
    betId: entry.betId,
    expiresAt: entry.expiresAt.toISOString(),
    inviteExpiresAt: entry.inviteExpiresAt?.toISOString() ?? null,
    invitedBy,
  };
}

// ---------------------------------------------------------------------------
// list my invites (scoped read for the challenge inbox / notifications)
// ---------------------------------------------------------------------------

export interface MyInviteDTO {
  /** The caller's own (Player B) lobby entry — what Accept/Decline acts on. */
  lobbyEntryId: string;
  gameType: LobbyGameType;
  gameName: string;
  /** Stake, in cents. */
  stakeAmount: number;
  from: { userId: string; displayName: string };
  inviteExpiresAt: string;
  expiresAt: string;
}

/**
 * List the caller's currently-pending incoming invites — the LobbyEntry rows
 * where they are an INVITED Player B whose invite window is still open. Backs
 * the challenge inbox and the ambient notification listener, neither of which
 * knows the entry ids up front (a challenge creates the entry server-side).
 *
 * Read-only: no ledger, no state change. Accept/Decline still go through
 * respondToInvite (the sole escrow handoff).
 */
export async function listMyInvites(callerUserId: string): Promise<MyInviteDTO[]> {
  const now = new Date();
  const rows = await prisma.lobbyEntry.findMany({
    where: {
      userId: callerUserId,
      role: LobbyRole.PLAYER_B,
      status: LobbyStatus.INVITED,
      inviteExpiresAt: { gt: now },
      expiresAt: { gt: now },
    },
    orderBy: { inviteExpiresAt: "asc" },
    take: 20,
  });
  if (rows.length === 0) return [];

  // Resolve challenger display names in a single query.
  const inviterIds = [
    ...new Set(rows.map((r) => r.invitedById).filter((id): id is string => Boolean(id))),
  ];
  const inviters = inviterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: inviterIds } },
        select: { id: true, displayName: true },
      })
    : [];
  const nameById = new Map(inviters.map((u) => [u.id, u.displayName ?? "Player"]));

  return rows
    .filter((r) => r.invitedById && r.inviteExpiresAt && isLobbyGameType(r.gameType))
    .map((r) => {
      const gameType = r.gameType as LobbyGameType;
      return {
        lobbyEntryId: r.id,
        gameType,
        gameName: LOBBY_GAME_META[gameType].name,
        stakeAmount: r.stakeAmount,
        from: {
          userId: r.invitedById as string,
          displayName: nameById.get(r.invitedById as string) ?? "Player",
        },
        inviteExpiresAt: (r.inviteExpiresAt as Date).toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      };
    });
}

// ---------------------------------------------------------------------------
// outgoing stream challenges
// ---------------------------------------------------------------------------

export interface MyOutgoingChallengeDTO {
  challengeId: string;
  status: StreamChallengeStatus;
  gameType: LobbyGameType;
  gameName: string;
  stakeAmount: number;
  streamer: { userId: string; displayName: string };
  expiresAt: string;
  createdAt: string;
  betId: string | null;
}

export async function listMyOutgoingChallenges(
  callerUserId: string,
): Promise<MyOutgoingChallengeDTO[]> {
  const rows = await prisma.streamChallenge.findMany({
    where: { challengerUserId: callerUserId },
    include: {
      streamer: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const now = new Date();

  return rows
    .filter((row) => isLobbyGameType(row.gameType))
    .map((row) => {
      const gameType = row.gameType as LobbyGameType;
      return {
        challengeId: row.id,
        status:
          row.status === StreamChallengeStatus.PENDING && row.expiresAt <= now
            ? StreamChallengeStatus.EXPIRED
            : row.status,
        gameType,
        gameName: LOBBY_GAME_META[gameType].name,
        stakeAmount: row.stakeAmount,
        streamer: {
          userId: row.streamer.id,
          displayName: row.streamer.displayName ?? "Player",
        },
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        betId: row.betId,
      };
    });
}

export async function cancelStreamChallenge(
  callerUserId: string,
  challengeId: string,
): Promise<void> {
  const challenge = await prisma.streamChallenge.findUnique({
    where: { id: challengeId },
  });
  if (!challenge) throw new NotFoundError("Challenge not found");
  if (challenge.challengerUserId !== callerUserId) {
    throw new AuthorizationError("You don't own that challenge");
  }
  if (challenge.status !== StreamChallengeStatus.PENDING) {
    throw new ConflictError(`Challenge is ${challenge.status.toLowerCase()}`);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.streamChallenge.updateMany({
      where: {
        id: challenge.id,
        challengerUserId: callerUserId,
        status: StreamChallengeStatus.PENDING,
      },
      data: {
        status: StreamChallengeStatus.CANCELLED,
        respondedAt: now,
      },
    });
    if (cancelled.count !== 1) {
      throw new ConflictError("This challenge is no longer pending");
    }
    await tx.lobbyEntry.updateMany({
      where: {
        id: {
          in: [
            challenge.challengerLobbyEntryId,
            challenge.streamerLobbyEntryId,
          ],
        },
        status: { in: [LobbyStatus.WAITING, LobbyStatus.INVITED] },
      },
      data: { status: LobbyStatus.CANCELLED },
    });
  });

  await publishLobbyEvent(LobbyChannels.invite(challenge.streamerUserId), {
    event: "CHALLENGE_CANCELLED",
  });
}

// ---------------------------------------------------------------------------
// list my joinable matches (accept -> play handoff)
// ---------------------------------------------------------------------------

export interface MyMatchDTO {
  betId: string;
  gameType: LobbyGameType;
  gameName: string;
  /** The caller's role in this bet — drives joinFromLobby. */
  myRole: "A" | "B";
  /** Session-creator id for joinFromLobby (always the bet's Player A). */
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  /** Stake in cents. */
  stakeAmount: number;
}

/**
 * The caller's currently-joinable matches — bets that reached MATCHED (via a
 * challenge accept or normal matchmaking) and haven't been played/voided yet.
 * Backs the accept->play handoff: both players poll this (via the ambient
 * listener) to get routed into the same game session for the betId.
 *
 * Read-only: no ledger, no state change.
 */
export async function listMyMatches(callerUserId: string): Promise<MyMatchDTO[]> {
  const entries = await prisma.lobbyEntry.findMany({
    where: {
      userId: callerUserId,
      status: LobbyStatus.MATCHED,
      betId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  const betIds = [
    ...new Set(entries.map((e) => e.betId).filter((id): id is string => Boolean(id))),
  ];
  if (betIds.length === 0) return [];

  // Only bets still in MATCHED are joinable (a played/voided/settled bet is not).
  const bets = await prisma.bet.findMany({
    where: { id: { in: betIds }, status: BetStatus.MATCHED },
    select: {
      id: true,
      playerAId: true,
      playerBId: true,
      gameMetadata: true,
      playerA: { select: { displayName: true } },
      playerB: { select: { displayName: true } },
    },
  });
  const betById = new Map(bets.map((b) => [b.id, b]));

  const out: MyMatchDTO[] = [];
  for (const entry of entries) {
    if (!entry.betId) continue;
    const bet = betById.get(entry.betId);
    if (!bet || !bet.playerBId) continue;
    if (!isLobbyGameType(entry.gameType)) continue;
    const gameType = entry.gameType as LobbyGameType;
    out.push({
      betId: bet.id,
      gameType,
      gameName: LOBBY_GAME_META[gameType].name,
      myRole: bet.playerAId === callerUserId ? "A" : "B",
      playerAId: bet.playerAId,
      playerBId: bet.playerBId,
      playerAName: bet.playerA?.displayName ?? "Player A",
      playerBName: bet.playerB?.displayName ?? "Player B",
      stakeAmount: entry.stakeAmount,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// expiry scan (worker)
// ---------------------------------------------------------------------------

export async function runLobbyExpiryScan(): Promise<{
  expired: number;
  inviteTimeouts: number;
  streamChallengesExpired: number;
}> {
  const now = new Date();
  let expired = 0;
  let inviteTimeouts = 0;
  let streamChallengesExpired = 0;

  // 1) Targeted stream challenges expire as a pair. Doing this before the
  // general lobby scan prevents their streamer entry reverting to WAITING.
  const staleStreamChallenges = await prisma.streamChallenge.findMany({
    where: {
      status: StreamChallengeStatus.PENDING,
      expiresAt: { lte: now },
    },
    take: 200,
  });

  for (const challenge of staleStreamChallenges) {
    try {
      const changed = await prisma.$transaction(async (tx) => {
        const updated = await tx.streamChallenge.updateMany({
          where: {
            id: challenge.id,
            status: StreamChallengeStatus.PENDING,
          },
          data: {
            status: StreamChallengeStatus.EXPIRED,
            respondedAt: now,
          },
        });
        if (updated.count !== 1) return false;

        await tx.lobbyEntry.updateMany({
          where: {
            id: {
              in: [
                challenge.challengerLobbyEntryId,
                challenge.streamerLobbyEntryId,
              ],
            },
            status: { in: [LobbyStatus.WAITING, LobbyStatus.INVITED] },
          },
          data: { status: LobbyStatus.EXPIRED },
        });
        return true;
      });
      if (!changed) continue;

      streamChallengesExpired += 1;
      await publishLobbyEvent(
        LobbyChannels.inviteExpired(challenge.challengerUserId),
        {
          event: "INVITE_EXPIRED",
          lobbyEntryId: challenge.streamerLobbyEntryId,
        },
      );
      await publishLobbyEvent(LobbyChannels.invite(challenge.streamerUserId), {
        event: "CHALLENGE_EXPIRED",
      });
    } catch (err) {
      console.error("[LOBBY_EXPIRY] failed to expire stream challenge", {
        id: challenge.id,
        err,
      });
    }
  }

  // 2) General expiry: WAITING or INVITED past expiresAt
  const staleEntries = await prisma.lobbyEntry.findMany({
    where: {
      status: { in: [LobbyStatus.WAITING, LobbyStatus.INVITED] },
      expiresAt: { lte: now },
    },
    take: 200,
  });

  for (const entry of staleEntries) {
    try {
      await prisma.lobbyEntry.update({
        where: { id: entry.id },
        data: { status: LobbyStatus.EXPIRED },
      });
      expired += 1;
      await publishLobbyEvent(LobbyChannels.expired(entry.userId), {
        event: "LOBBY_EXPIRED",
        lobbyEntryId: entry.id,
      });
      await publishLobbyEvent(LobbyChannels.game(entry.gameType), {
        event: "PLAYER_LEFT",
        lobbyEntryId: entry.id,
        role: entry.role,
      });
    } catch (err) {
      console.error("[LOBBY_EXPIRY] failed to expire entry", { id: entry.id, err });
    }
  }

  // 3) Normal-lobby invite timeouts: INVITED whose inviteExpiresAt passed but main
  //    expiresAt is still in the future — revert to WAITING.
  const timedOutInvites = await prisma.lobbyEntry.findMany({
    where: {
      status: LobbyStatus.INVITED,
      inviteExpiresAt: { lte: now },
      expiresAt: { gt: now },
    },
    take: 200,
  });

  for (const entry of timedOutInvites) {
    try {
      const previousInviter = entry.invitedById;
      await prisma.lobbyEntry.update({
        where: { id: entry.id },
        data: {
          status: LobbyStatus.WAITING,
          invitedById: null,
          inviteExpiresAt: null,
        },
      });
      inviteTimeouts += 1;

      if (previousInviter) {
        await publishLobbyEvent(LobbyChannels.inviteExpired(previousInviter), {
          event: "INVITE_EXPIRED",
          lobbyEntryId: entry.id,
        });
      }
      await publishLobbyEvent(LobbyChannels.game(entry.gameType), {
        event: "PLAYER_JOINED",
        role: LobbyRole.PLAYER_B,
        lobbyEntryId: entry.id,
        userId: entry.userId,
      });
    } catch (err) {
      console.error("[LOBBY_EXPIRY] failed to time out invite", { id: entry.id, err });
    }
  }

  return { expired, inviteTimeouts, streamChallengesExpired };
}

// ---------------------------------------------------------------------------
// parseRole helper for route input validation
// ---------------------------------------------------------------------------

export function parseLobbyRole(value: unknown): LobbyRole {
  if (value === LobbyRole.PLAYER_A || value === LobbyRole.PLAYER_B) return value;
  if (value === "PLAYER_A") return LobbyRole.PLAYER_A;
  if (value === "PLAYER_B") return LobbyRole.PLAYER_B;
  throw new ValidationError(`Invalid role: ${String(value)}`);
}

// Re-export for routes
export { LobbyRole, LobbyStatus } from "../../../generated/prisma/client";

// Silence unused AppError in case the file grows
void AppError;
