// =============================================================================
// Integration Tests: /play game integrity
// =============================================================================
// Outcomes of real-money games are decided on the server: the deck is shuffled
// and dealt there and never sent to a browser, every dart's landing is drawn
// there, and no request can declare a winner. Every draw and result is kept in
// an append-only event log. The no-show sweep leaves matches in play alone and
// pays out matches that finished but were never settled.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import {
  callApi,
  createFullScenario,
  createTestSession,
  disconnectTestPrisma,
  getTestPrisma,
} from "./helpers.js";
import { holdEscrow } from "../../src/lib/ledger/escrow.js";
import { hitTest } from "../../src/lib/games/darts-board.js";
import { rank, type PlayingCard } from "../../src/lib/games/cards.js";
import { processBetExpiryScan } from "../../src/workers/bet-expiry.worker.js";
import { BetMatchType, BetOutcome, BetStatus } from "../../generated/prisma/client.js";

const prisma = getTestPrisma();
const tx = prisma as never;

let scenario: Awaited<ReturnType<typeof createFullScenario>>;
let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  scenario = await createFullScenario(tx, {
    playerABalance: 500,
    playerBBalance: 500,
    platformFeePercent: 0,
    revSharePercent: 0,
  });
  tokenA = (await createTestSession(tx, scenario.playerA.id)).sessionToken;
  tokenB = (await createTestSession(tx, scenario.playerB.id)).sessionToken;
  await prisma.user.updateMany({
    where: { id: { in: [scenario.playerA.id, scenario.playerB.id] } },
    data: { kycStatus: "VERIFIED" },
  });
});

afterAll(async () => {
  await disconnectTestPrisma();
});

async function matchedBet(amount = "10.00") {
  const stake = new Decimal(amount);
  const bet = await prisma.bet.create({
    data: {
      gameId: scenario.game.id,
      playerAId: scenario.playerA.id,
      amount: stake,
      currency: "USD",
      status: BetStatus.PENDING_CONSENT,
      matchType: BetMatchType.GAME_LOBBY,
      platformFeePercent: scenario.game.platformFeePercent,
      expiresAt: new Date(Date.now() + 300_000),
    },
  });
  await holdEscrow(tx, { playerId: scenario.playerA.id, betId: bet.id, amount: stake, idempotencyKey: `gi_a_${bet.id}` });
  await holdEscrow(tx, { playerId: scenario.playerB.id, betId: bet.id, amount: stake, idempotencyKey: `gi_b_${bet.id}` });
  return prisma.bet.update({
    where: { id: bet.id },
    data: { status: BetStatus.MATCHED, playerBId: scenario.playerB.id, matchedAt: new Date() },
  });
}

/** Start a lobby match for the bet, as both players' clients do. */
async function startMatch(betId: string, gameType: "cards" | "darts") {
  const sessionId = betId.slice(0, 8).toUpperCase();
  await callApi("POST", "/api/demo/game", { sessionToken: tokenA, body: { betId, gameType, sessionId } });
  const joined = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
    sessionToken: tokenB,
    body: { action: "join", betId, gameType },
  });
  expect(joined.status).toBe(200);
  return { sessionId, joined };
}

/** Make the bet look older than the no-show window, as the sweep sees it. */
async function ageBet(betId: string) {
  await prisma.$executeRaw`UPDATE bets SET updated_at = NOW() - INTERVAL '1 hour' WHERE id = ${betId}::uuid`;
}

describe("Higher / Lower is dealt and decided by the server", () => {
  it("deals on join, never exposes the deck, and decides the call", async () => {
    const bet = await matchedBet();
    const { sessionId, joined } = await startMatch(bet.id, "cards");

    const current = joined.body.gameData.currentCard as PlayingCard;
    expect(current).toBeTruthy();
    expect(joined.body.gameData.nextCard).toBeNull();
    expect(JSON.stringify(joined.body)).not.toMatch(/deck|secret/i);

    // Only Player A calls; nobody can name the winner.
    const byB = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
      sessionToken: tokenB,
      body: { action: "guess", direction: "higher" },
    });
    expect(byB.status).toBe(422);
    for (const action of ["resolve", "setGameData"]) {
      const res = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
        sessionToken: tokenA,
        body: { action, winner: "A", data: { nextCard: current, result: "correct" } },
      });
      expect(res.status).toBe(422);
    }

    const guessed = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
      sessionToken: tokenA,
      body: { action: "guess", direction: "higher" },
    });
    expect(guessed.status).toBe(200);
    const next = guessed.body.gameData.nextCard as PlayingCard;
    const expectedWinner = rank(next) > rank(current) ? "A" : "B";
    expect(guessed.body.winner).toBe(expectedWinner);
    expect(guessed.body.status).toBe("finished");

    // The event log holds the full shuffled order, and the card turned over
    // is the next one in it.
    const events = await prisma.gameEvent.findMany({ where: { sessionId }, orderBy: { seq: "asc" } });
    expect(events.map((event) => event.type)).toEqual(["created", "joined", "deck_shuffled", "guess", "finished"]);
    const shuffled = events[2].data as unknown as { faceUp: PlayingCard; deck: PlayingCard[] };
    expect(shuffled.faceUp).toEqual(current);
    expect(shuffled.deck).toHaveLength(51);
    expect(shuffled.deck[0]).toEqual(next);

    // Played once, finished: a second call changes nothing.
    const again = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
      sessionToken: tokenA,
      body: { action: "guess", direction: "lower" },
    });
    expect(again.status).toBe(422);
  });

  it("the event log cannot be edited or deleted", async () => {
    const event = await prisma.gameEvent.findFirstOrThrow();
    await expect(
      prisma.gameEvent.update({ where: { id: event.id }, data: { type: "tampered" } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.gameEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
  });
});

describe("Darts is scored by the server", () => {
  it("draws each landing, scores it by the board, and enforces turns", async () => {
    const bet = await matchedBet();
    const { sessionId } = await startMatch(bet.id, "darts");

    const outOfTurn = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
      sessionToken: tokenB,
      body: { action: "throw", aimX: 450, aimY: 272, holdMs: 800 },
    });
    expect(outOfTurn.status).toBe(422);

    const thrown = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
      sessionToken: tokenA,
      body: { action: "throw", aimX: 450, aimY: 150, holdMs: 800 },
    });
    expect(thrown.status).toBe(200);
    const dart = thrown.body.gameData.currentDarts[0];
    expect(hitTest(dart.x, dart.y).score).toBe(dart.score);
    expect(thrown.body.gameData.scoreA).toBe(301 - dart.score);

    const events = await prisma.gameEvent.findMany({ where: { sessionId, type: "throw" } });
    expect(events).toHaveLength(1);
    expect((events[0].data as { dart: { x: number } }).dart.x).toBe(dart.x);
  });

  it("plays a full match to a result that settles the bet", async () => {
    const bet = await matchedBet();
    const { sessionId } = await startMatch(bet.id, "darts");

    let state = (await callApi("GET", `/api/demo/game/${sessionId}`, { sessionToken: tokenA })).body;
    for (let i = 0; i < 40 && state.status !== "finished"; i++) {
      const data = state.gameData;
      if (data.phase === "showing" || data.phase === "bust") {
        // Skip the end-of-turn pause rather than wait for it.
        await prisma.$executeRaw`
          UPDATE game_sessions
          SET public_state = jsonb_set(public_state, '{advanceAt}', '1'::jsonb)
          WHERE id = ${sessionId}`;
        state = (await callApi("GET", `/api/demo/game/${sessionId}`, { sessionToken: tokenA })).body;
        continue;
      }
      const res = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
        sessionToken: data.currentTurn === "A" ? tokenA : tokenB,
        body: { action: "throw", aimX: 450, aimY: 180, holdMs: 800 },
      });
      expect(res.status).toBe(200);
      state = res.body;
    }
    expect(state.status).toBe("finished");

    const settled = await callApi("POST", "/api/demo/settle-bet", {
      sessionToken: tokenA,
      body: { betId: bet.id, apiKey: scenario.apiKey.rawKey, sessionId },
    });
    expect(settled.status).toBe(200);
    const expected = { A: BetOutcome.PLAYER_A_WIN, B: BetOutcome.PLAYER_B_WIN, draw: BetOutcome.DRAW }[
      state.winner as "A" | "B" | "draw"
    ];
    expect(settled.body.outcome).toBe(expected);
  });
});

describe("The no-show sweep respects play", () => {
  it("does not void a match that is being played", async () => {
    const bet = await matchedBet();
    await startMatch(bet.id, "darts");
    await ageBet(bet.id);

    await processBetExpiryScan({} as never);

    const after = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(after.status).toBe(BetStatus.MATCHED);
  });

  it("pays out a finished match that nobody settled", async () => {
    const bet = await matchedBet();
    const { sessionId } = await startMatch(bet.id, "cards");
    const guessed = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
      sessionToken: tokenA,
      body: { action: "guess", direction: "higher" },
    });
    await ageBet(bet.id);
    await prisma.$executeRaw`UPDATE game_sessions SET last_activity_at = NOW() - INTERVAL '1 hour' WHERE id = ${sessionId}`;

    await processBetExpiryScan({} as never);

    const after = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(after.status).toBe(BetStatus.SETTLED);
    expect(after.outcome).toBe(
      guessed.body.winner === "A" ? BetOutcome.PLAYER_A_WIN : BetOutcome.PLAYER_B_WIN,
    );
  });

  it("a player who walks away mid-match forfeits it", async () => {
    const bet = await matchedBet();
    const { sessionId } = await startMatch(bet.id, "darts");
    // A threw one dart and left; it is still A's turn.
    await callApi("PATCH", `/api/demo/game/${sessionId}`, {
      sessionToken: tokenA,
      body: { action: "throw", aimX: 450, aimY: 150, holdMs: 800 },
    });
    await ageBet(bet.id);
    await prisma.$executeRaw`UPDATE game_sessions SET last_activity_at = NOW() - INTERVAL '1 hour' WHERE id = ${sessionId}`;

    await processBetExpiryScan({} as never);

    const after = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(after.status).toBe(BetStatus.SETTLED);
    expect(after.outcome).toBe(BetOutcome.PLAYER_B_WIN);
    const events = await prisma.gameEvent.findMany({ where: { sessionId }, orderBy: { seq: "asc" } });
    expect(events.map((event) => event.type)).toContain("forfeit_abandoned");
  });

  it("still voids a match nobody played", async () => {
    const bet = await matchedBet();
    await ageBet(bet.id);

    await processBetExpiryScan({} as never);

    const after = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(after.status).toBe(BetStatus.VOIDED);
  });
});
