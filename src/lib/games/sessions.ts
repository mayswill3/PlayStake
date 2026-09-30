// =============================================================================
// PlayStake — /play game sessions
// =============================================================================
// Matches live in Postgres, not in process memory, so they survive a restart
// or a second web instance, and every draw and result is on the record.
//
// The server is the only thing that decides an outcome. Clients send what the
// player did — a cell, a higher/lower call, an aim point — and get back the
// state the server computed. The undealt deck (`secretState`) never leaves
// the server. Each change is written with a matching row in the append-only
// `game_events` log, in the same transaction.
// =============================================================================

import { randomInt } from "node:crypto";
import { Prisma, type GameSession } from "../../../generated/prisma/client";
import { prisma, withTransaction, type TxClient } from "../db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { sideOf } from "../demo/access";
import { dealCards, initialCards, isGuess, resolveGuess, type CardsPublicState, type CardsSecretState } from "./cards";
import { advanceDarts, initialDarts, throwDart } from "./darts";
import type { DartsState } from "./darts-board";
import { applyMove, initialTicTacToe, type TicTacToeState } from "./tictactoe";

export type GameType = "tictactoe" | "cards" | "darts";
export const GAME_TYPES: GameType[] = ["tictactoe", "cards", "darts"];

export type SessionStatus = "waiting" | "playing" | "finished";
export type Winner = "A" | "B" | "draw";

/** What a client may see. Never includes `secretState`. */
export interface GameSessionView {
  id: string;
  betId: string | null;
  board?: (string | null)[];
  turn?: "A" | "B";
  playerAId: string;
  playerBId: string | null;
  status: SessionStatus;
  winner: Winner | null;
  createdAt: number;
  lastActivityAt: number;
  gameType: GameType;
  gameData: Record<string, unknown>;
}

function currentPublicState(row: GameSession, now: number): unknown {
  if (row.gameType === "darts") return advanceDarts(row.publicState as unknown as DartsState, now);
  return row.publicState;
}

export function toView(row: GameSession, now = Date.now()): GameSessionView {
  const state = currentPublicState(row, now);
  const view: GameSessionView = {
    id: row.id,
    betId: row.betId,
    playerAId: row.playerAId,
    playerBId: row.playerBId,
    status: row.status as SessionStatus,
    winner: row.winner as Winner | null,
    createdAt: row.createdAt.getTime(),
    lastActivityAt: row.lastActivityAt.getTime(),
    gameType: row.gameType as GameType,
    gameData: {},
  };
  if (row.gameType === "tictactoe") {
    const ttt = state as TicTacToeState;
    view.board = ttt.board;
    view.turn = ttt.turn;
  } else {
    view.gameData = state as Record<string, unknown>;
  }
  return view;
}

function initialState(gameType: GameType): { publicState: unknown; secretState: unknown } {
  if (gameType === "tictactoe") return { publicState: initialTicTacToe(), secretState: {} };
  if (gameType === "cards") return initialCards();
  return { publicState: initialDarts(), secretState: {} };
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

async function appendEvent(
  tx: TxClient,
  sessionId: string,
  actorId: string | null,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  const last = await tx.gameEvent.findFirst({
    where: { sessionId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  await tx.gameEvent.create({
    data: { sessionId, seq: (last?.seq ?? 0) + 1, actorId, type, data: json(data) },
  });
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Create a session. Idempotent on `explicitId`: both lobby-matched players
 * create with the same id derived from the bet, and the second arrival gets
 * the existing session back unchanged.
 */
export async function createGameSession(input: {
  playerAId: string;
  betId: string | null;
  gameType: GameType;
  explicitId?: string;
}): Promise<GameSessionView> {
  if (input.explicitId) {
    const existing = await prisma.gameSession.findUnique({ where: { id: input.explicitId } });
    if (existing) return toView(existing);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = input.explicitId ?? newJoinCode();
    const { publicState, secretState } = initialState(input.gameType);
    try {
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.gameSession.create({
          data: {
            id,
            gameType: input.gameType,
            betId: input.betId,
            playerAId: input.playerAId,
            status: "waiting",
            publicState: json(publicState),
            secretState: json(secretState),
          },
        });
        await appendEvent(tx as TxClient, id, input.playerAId, "created", {
          gameType: input.gameType,
          betId: input.betId,
          playerAId: input.playerAId,
        });
        return created;
      });
      return toView(row);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Lost the race to the other lobby player: theirs is the session.
      if (input.explicitId) {
        const existing = await prisma.gameSession.findUnique({ where: { id: input.explicitId } });
        if (existing) return toView(existing);
      }
      // Otherwise a random code collided; draw another.
    }
  }
  throw new Error("Could not allocate a game code");
}

export async function getGameSession(id: string): Promise<GameSessionView | null> {
  const row = await prisma.gameSession.findUnique({ where: { id } });
  return row ? toView(row) : null;
}

export async function listWaitingSessions(): Promise<GameSessionView[]> {
  const rows = await prisma.gameSession.findMany({
    where: { status: "waiting" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row) => toView(row));
}

/** Lock the session row for the rest of the transaction. */
async function lockSession(tx: TxClient, id: string): Promise<GameSession> {
  await tx.$queryRaw`SELECT id FROM game_sessions WHERE id = ${id} FOR UPDATE`;
  const row = await tx.gameSession.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Game not found");
  return row;
}

export async function joinGameSession(
  id: string,
  userId: string,
  opts: { betId?: string; gameType?: unknown; beforeJoin?: (session: GameSessionView) => Promise<void> },
): Promise<GameSessionView> {
  return withTransaction(async (tx) => {
    const row = await lockSession(tx, id);
    if (row.status !== "waiting") throw new ValidationError("Game already started");
    if (row.playerAId === userId) throw new ValidationError("Cannot play against yourself");
    if (opts.gameType && opts.gameType !== row.gameType) {
      throw new ValidationError(`This code is for a different game (${row.gameType})`);
    }
    await opts.beforeJoin?.(toView(row));

    // Both players are in: this is where the cards are shuffled and dealt.
    let publicState = row.publicState as unknown;
    let secretState = row.secretState as unknown;
    if (row.gameType === "cards") {
      const dealt = dealCards();
      publicState = dealt.publicState;
      secretState = dealt.secretState;
    }

    const updated = await tx.gameSession.update({
      where: { id },
      data: {
        playerBId: userId,
        betId: opts.betId ?? row.betId,
        status: "playing",
        publicState: json(publicState),
        secretState: json(secretState),
        lastActivityAt: new Date(),
      },
    });
    await appendEvent(tx, id, userId, "joined", { playerBId: userId, betId: updated.betId });
    if (row.gameType === "cards") {
      const dealt = secretState as CardsSecretState;
      await appendEvent(tx, id, null, "deck_shuffled", {
        // The whole order, so the result can be checked after the match.
        faceUp: (publicState as CardsPublicState).currentCard,
        deck: dealt.deck,
      });
    }
    return toView(updated);
  });
}

export async function setSessionBet(id: string, betId: string): Promise<GameSessionView> {
  return withTransaction(async (tx) => {
    await lockSession(tx, id);
    const updated = await tx.gameSession.update({ where: { id }, data: { betId } });
    await appendEvent(tx, id, null, "bet_linked", { betId });
    return toView(updated);
  });
}

/**
 * Apply one player action. The acting side is derived from the caller, and
 * the outcome — any random draw and any winner — is computed here.
 */
export async function playAction(
  id: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<GameSessionView> {
  return withTransaction(async (tx) => {
    const row = await lockSession(tx, id);
    const player = sideOf(userId, row);
    if (!player) throw new AuthorizationError("You are not a player in this game");
    if (row.status !== "playing") throw new ValidationError("Game is not in progress");

    const now = Date.now();
    let publicState: unknown;
    let secretState: unknown = row.secretState;
    let winner: Winner | null = null;
    let event: { type: string; data: Record<string, unknown> };

    try {
      if (row.gameType === "tictactoe" && body.action === "move") {
        const cell = Number(body.cell);
        const result = applyMove(row.publicState as unknown as TicTacToeState, cell, player);
        publicState = result.state;
        winner = result.winner;
        event = { type: "move", data: { player, cell } };
      } else if (row.gameType === "cards" && body.action === "guess") {
        if (player !== "A") throw new Error("Only Player A makes the call");
        if (!isGuess(body.direction)) throw new Error("direction must be higher or lower");
        const result = resolveGuess(
          row.publicState as unknown as CardsPublicState,
          row.secretState as unknown as CardsSecretState,
          body.direction,
        );
        publicState = result.publicState;
        secretState = result.secretState;
        winner = result.winner;
        event = {
          type: "guess",
          data: {
            player,
            direction: body.direction,
            currentCard: result.publicState.currentCard,
            nextCard: result.publicState.nextCard,
            result: result.publicState.result,
          },
        };
      } else if (row.gameType === "darts" && body.action === "throw") {
        const aimX = Number(body.aimX);
        const aimY = Number(body.aimY);
        const holdMs = Number(body.holdMs);
        if (![aimX, aimY, holdMs].every(Number.isFinite)) {
          throw new Error("aimX, aimY and holdMs are required");
        }
        const result = throwDart(row.publicState as unknown as DartsState, player, aimX, aimY, holdMs, now);
        publicState = result.state;
        winner = result.winner;
        event = { type: "throw", data: { player, aim: result.aim, dart: result.dart } };
      } else {
        throw new Error("Invalid action for this game");
      }
    } catch (error) {
      if (error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError)) {
        throw new ValidationError(error.message);
      }
      throw error;
    }

    const updated = await tx.gameSession.update({
      where: { id },
      data: {
        publicState: json(publicState),
        secretState: json(secretState),
        lastActivityAt: new Date(now),
        ...(winner ? { status: "finished", winner, finishedAt: new Date(now) } : {}),
      },
    });
    await appendEvent(tx, id, userId, event.type, event.data);
    if (winner) await appendEvent(tx, id, null, "finished", { winner });
    return toView(updated, now);
  });
}

/**
 * The finished session that decides this bet, if there is one. Only a session
 * for the same bet, with the same two players on the same sides, counts.
 */
export async function findFinishedSessionForBet(
  tx: TxClient,
  bet: { id: string; playerAId: string; playerBId: string | null },
): Promise<GameSession | null> {
  if (!bet.playerBId) return null;
  return tx.gameSession.findFirst({
    where: {
      betId: bet.id,
      playerAId: bet.playerAId,
      playerBId: bet.playerBId,
      status: "finished",
      winner: { not: null },
    },
    orderBy: { finishedAt: "asc" },
  });
}

/** Most recent play on any session for these bets, keyed by bet id. */
export async function lastActivityByBet(betIds: string[]): Promise<Map<string, Date>> {
  if (betIds.length === 0) return new Map();
  const rows = await prisma.gameSession.groupBy({
    by: ["betId"],
    where: { betId: { in: betIds } },
    _max: { lastActivityAt: true },
  });
  return new Map(
    rows
      .filter((row) => row.betId && row._max.lastActivityAt)
      .map((row) => [row.betId as string, row._max.lastActivityAt as Date]),
  );
}
