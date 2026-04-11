// =============================================================================
// PlayStake — Lobby Service
// =============================================================================
// Core business logic for the matchmaking lobby. Kept separate from route
// handlers so the expiry worker and (future) tests can reuse it.
// =============================================================================

import { prisma } from "@/lib/db/client";
import { LobbyRole, LobbyStatus, BetStatus } from "../../../generated/prisma/client";
import {
  AppError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors/index";
import { centsToDollars } from "@/lib/utils/money";
import {
  isLobbyGameType,
  getDemoGameId,
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

    const previousInviter = entry.invitedById;

    await prisma.lobbyEntry.update({
      where: { id: entry.id },
      data: {
        status: LobbyStatus.WAITING,
        invitedById: null,
        inviteExpiresAt: null,
      },
    });

    if (previousInviter) {
      await publishLobbyEvent(LobbyChannels.inviteDeclined(previousInviter), {
        event: "INVITE_DECLINED",
        lobbyEntryId: entry.id,
      });
    }
    await publishLobbyEvent(LobbyChannels.game(entry.gameType), {
      event: "PLAYER_JOINED",
      role: LobbyRole.PLAYER_B,
      lobbyEntryId: entry.id,
      userId: entry.userId,
    });

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

    const playerAEntry = await tx.lobbyEntry.findFirst({
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

    // Create the bet in PENDING_CONSENT so the existing widget flow can
    // run escrow via consent + accept.
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

    return {
      betId: bet.id,
      playerAUserId: playerAEntry.userId,
      playerBUserId: playerBEntry.userId,
      gameType,
    };
  });

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
// expiry scan (worker)
// ---------------------------------------------------------------------------

export async function runLobbyExpiryScan(): Promise<{
  expired: number;
  inviteTimeouts: number;
}> {
  const now = new Date();
  let expired = 0;
  let inviteTimeouts = 0;

  // 1) General expiry: WAITING or INVITED past expiresAt
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

  // 2) Invite timeouts: INVITED whose inviteExpiresAt passed but main
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

  return { expired, inviteTimeouts };
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
