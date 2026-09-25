// =============================================================================
// Integration Tests: Demo game routes — who may do what
// =============================================================================
// Before this, the demo routes took player identity from the request body and
// /api/demo/settle-bet never checked that the game session belonged to the
// bet. Any signed-in user could forge a session, pick a winner, and settle a
// stranger's escrowed bet with it. These tests reproduce that chain and prove
// each link is now closed — and that the real /play flow still works.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import {
  callApi,
  createFullScenario,
  createTestSession,
  createTestUser,
  disconnectTestPrisma,
  getTestPrisma,
} from "./helpers.js";
import { holdEscrow } from "../../src/lib/ledger/escrow.js";
import {
  BetMatchType,
  BetOutcome,
  BetStatus,
} from "../../generated/prisma/client.js";

const prisma = getTestPrisma();
const tx = prisma as never;

let scenario: Awaited<ReturnType<typeof createFullScenario>>;
let tokenA: string;
let tokenB: string;
let tokenStranger: string;
let tokenAccomplice: string;
let strangerId: string;

beforeAll(async () => {
  // Zero fee and zero revenue share on purpose: this file commits a real
  // settlement, and a non-zero fee would leave money in the shared
  // PLATFORM_REVENUE account that other suites assume starts empty.
  scenario = await createFullScenario(tx, {
    playerABalance: 500,
    playerBBalance: 500,
    platformFeePercent: 0,
    revSharePercent: 0,
  });
  tokenA = (await createTestSession(tx, scenario.playerA.id)).sessionToken;
  tokenB = (await createTestSession(tx, scenario.playerB.id)).sessionToken;

  const stranger = await createTestUser(tx, { displayName: "Stranger" });
  const accomplice = await createTestUser(tx, { displayName: "Accomplice" });
  strangerId = stranger.id;
  tokenStranger = (await createTestSession(tx, stranger.id)).sessionToken;
  tokenAccomplice = (await createTestSession(tx, accomplice.id)).sessionToken;
});

afterAll(async () => {
  await disconnectTestPrisma();
});

/** A MATCHED GAME_LOBBY bet between A and B with both stakes in escrow. */
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
  await holdEscrow(tx, {
    playerId: scenario.playerA.id,
    betId: bet.id,
    amount: stake,
    idempotencyKey: `harden_a_${bet.id}`,
  });
  await prisma.bet.update({
    where: { id: bet.id },
    data: { status: BetStatus.OPEN, playerAConsentedAt: new Date() },
  });
  await holdEscrow(tx, {
    playerId: scenario.playerB.id,
    betId: bet.id,
    amount: stake,
    idempotencyKey: `harden_b_${bet.id}`,
  });
  return prisma.bet.update({
    where: { id: bet.id },
    data: { status: BetStatus.MATCHED, playerBId: scenario.playerB.id, matchedAt: new Date() },
  });
}

/** Session id the lobby handoff derives, so both players meet on one session. */
const derivedSessionId = (betId: string) => betId.slice(0, 8).toUpperCase();

describe("Demo hardening: the exploit chain is closed", () => {
  it("rejects anyone without a session", async () => {
    const res = await callApi("POST", "/api/demo/game", { body: { gameType: "cards" } });
    expect(res.status).toBe(401);
  });

  it("a stranger cannot settle someone else's bet at all", async () => {
    const bet = await matchedBet();

    const res = await callApi("POST", "/api/demo/settle-bet", {
      sessionToken: tokenStranger,
      body: { betId: bet.id, apiKey: scenario.apiKey.rawKey, sessionId: "whatever" },
    });

    expect(res.status).toBe(403);
    const after = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(after.status).toBe(BetStatus.MATCHED);
  });

  it("a forged session with a chosen winner cannot settle a real bet", async () => {
    const bet = await matchedBet();

    // The stranger builds a session of their own, gets an accomplice to join,
    // and declares side A the winner. This is the exact chain that used to work.
    const created = await callApi("POST", "/api/demo/game", {
      sessionToken: tokenStranger,
      body: { gameType: "cards" },
    });
    expect(created.status).toBe(201);
    const forgedId = created.body.id as string;

    const joined = await callApi("PATCH", `/api/demo/game/${forgedId}`, {
      sessionToken: tokenAccomplice,
      body: { action: "join", gameType: "cards" },
    });
    expect(joined.status).toBe(200);
    expect(joined.body.status).toBe("playing");

    const resolved = await callApi("PATCH", `/api/demo/game/${forgedId}`, {
      sessionToken: tokenStranger,
      body: { action: "resolve", winner: "A" },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.winner).toBe("A");

    // The stranger is not in the bet: refused outright.
    const byStranger = await callApi("POST", "/api/demo/settle-bet", {
      sessionToken: tokenStranger,
      body: { betId: bet.id, apiKey: scenario.apiKey.rawKey, sessionId: forgedId },
    });
    expect(byStranger.status).toBe(403);

    // Even a real player in the bet can't use a session that isn't the bet's.
    const byPlayer = await callApi("POST", "/api/demo/settle-bet", {
      sessionToken: tokenB,
      body: { betId: bet.id, apiKey: scenario.apiKey.rawKey, sessionId: forgedId },
    });
    expect(byPlayer.status).toBe(403);
    expect(byPlayer.body.error).toMatch(/does not belong to this bet/);

    const after = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(after.status).toBe(BetStatus.MATCHED);
    expect(after.outcome).toBeNull();
  });

  it("cannot attach someone else's bet to a session", async () => {
    const bet = await matchedBet();

    // Neither at creation...
    const created = await callApi("POST", "/api/demo/game", {
      sessionToken: tokenStranger,
      body: { betId: bet.id, gameType: "cards", sessionId: derivedSessionId(bet.id) },
    });
    expect(created.status).toBe(403);

    // ...nor afterwards, on a session the stranger does own.
    const own = await callApi("POST", "/api/demo/game", {
      sessionToken: tokenStranger,
      body: { gameType: "cards" },
    });
    const bound = await callApi("PATCH", `/api/demo/game/${own.body.id}`, {
      sessionToken: tokenStranger,
      body: { action: "setBetId", betId: bet.id },
    });
    expect(bound.status).toBe(403);
  });

  it("an explicit session id needs a bet to be checked against", async () => {
    const res = await callApi("POST", "/api/demo/game", {
      sessionToken: tokenStranger,
      body: { gameType: "cards", sessionId: "GUESSED1" },
    });
    expect(res.status).toBe(422);
  });

  it("cleanup only ever touches the caller's own bets", async () => {
    const bet = await matchedBet();

    // The body used to name the player. It is ignored now.
    const res = await callApi("POST", "/api/demo/cleanup-bets", {
      sessionToken: tokenStranger,
      body: { playerId: scenario.playerA.id, gameId: scenario.game.id },
    });

    expect(res.status).toBe(200);
    expect(res.body.voidedCount).toBe(0);
    const after = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(after.status).toBe(BetStatus.MATCHED);
  });
});

describe("Demo hardening: identity comes from the session", () => {
  it("attributes a move to whoever is asking, not to the side named in the body", async () => {
    const created = await callApi("POST", "/api/demo/game", {
      sessionToken: tokenA,
      body: { gameType: "tictactoe" },
    });
    const id = created.body.id as string;
    await callApi("PATCH", `/api/demo/game/${id}`, {
      sessionToken: tokenB,
      body: { action: "join", gameType: "tictactoe" },
    });

    // It's A's turn. B claims to be A and tries to move.
    const cheat = await callApi("PATCH", `/api/demo/game/${id}`, {
      sessionToken: tokenB,
      body: { action: "move", cell: 0, player: "A" },
    });
    expect(cheat.status).toBe(422);
    expect(cheat.body.error).toMatch(/Not your turn/);

    // A moves for real.
    const real = await callApi("PATCH", `/api/demo/game/${id}`, {
      sessionToken: tokenA,
      body: { action: "move", cell: 0 },
    });
    expect(real.status).toBe(200);
    expect(real.body.board[0]).toBe("X");

    // A stranger can watch but not touch.
    const peek = await callApi("GET", `/api/demo/game/${id}`, { sessionToken: tokenStranger });
    expect(peek.status).toBe(200);
    const poke = await callApi("PATCH", `/api/demo/game/${id}`, {
      sessionToken: tokenStranger,
      body: { action: "setGameData", data: { hacked: true } },
    });
    expect(poke.status).toBe(403);
  });

  it("joins as the caller, whatever playerBId the body claims", async () => {
    const created = await callApi("POST", "/api/demo/game", {
      sessionToken: tokenA,
      body: { gameType: "cards" },
    });
    const joined = await callApi("PATCH", `/api/demo/game/${created.body.id}`, {
      sessionToken: tokenStranger,
      body: { action: "join", playerBId: scenario.playerB.id },
    });
    expect(joined.status).toBe(200);
    expect(joined.body.playerBId).toBe(strangerId);
  });
});

describe("Demo hardening: the real /play flow still works", () => {
  it("two matched players can play and settle through the lobby handoff", async () => {
    const bet = await matchedBet("20.00");
    const sessionId = derivedSessionId(bet.id);

    // Player B arrives first and creates the session. Side A is still the
    // bet's player A — the creator does not become A by arriving early.
    const created = await callApi("POST", "/api/demo/game", {
      sessionToken: tokenB,
      body: { betId: bet.id, gameType: "cards", sessionId },
    });
    expect(created.status).toBe(201);
    expect(created.body.playerAId).toBe(scenario.playerA.id);

    // Player A arrives; idempotent create returns the same session.
    const again = await callApi("POST", "/api/demo/game", {
      sessionToken: tokenA,
      body: { betId: bet.id, gameType: "cards", sessionId },
    });
    expect(again.body.id).toBe(sessionId);

    const joined = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
      sessionToken: tokenB,
      body: { action: "join", betId: bet.id, gameType: "cards" },
    });
    expect(joined.status).toBe(200);
    expect(joined.body.playerBId).toBe(scenario.playerB.id);

    const resolved = await callApi("PATCH", `/api/demo/game/${sessionId}`, {
      sessionToken: tokenA,
      body: { action: "resolve", winner: "B" },
    });
    expect(resolved.status).toBe(200);

    const settled = await callApi("POST", "/api/demo/settle-bet", {
      sessionToken: tokenB,
      body: { betId: bet.id, apiKey: scenario.apiKey.rawKey, sessionId },
    });
    expect(settled.status).toBe(200);
    expect(settled.body.success).toBe(true);
    expect(settled.body.outcome).toBe(BetOutcome.PLAYER_B_WIN);
    // The whole $40 pot: this scenario runs with no platform fee.
    expect(settled.body.winnerPayout).toBeCloseTo(40, 2);

    const after = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(after.status).toBe(BetStatus.SETTLED);
    expect(after.resultVerified).toBe(true);

    // The other player can read the result; a stranger cannot.
    const mine = await callApi("GET", `/api/demo/bet-result/${bet.id}`, { sessionToken: tokenA });
    expect(mine.status).toBe(200);
    expect(mine.body.outcome).toBe(BetOutcome.PLAYER_B_WIN);
    const theirs = await callApi("GET", `/api/demo/bet-result/${bet.id}`, { sessionToken: tokenStranger });
    expect(theirs.status).toBe(403);
  });

  it("a key from a different developer cannot settle this game's bets", async () => {
    const bet = await matchedBet();
    const other = await createFullScenario(tx);

    const res = await callApi("POST", "/api/demo/settle-bet", {
      sessionToken: tokenA,
      body: { betId: bet.id, apiKey: other.apiKey.rawKey, sessionId: "x" },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not issued for that game/);
  });
});

