import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../store";
import { prisma } from "@/lib/db/client";

// POST /api/demo/game/:id/result — Report game result to PlayStake
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameSessionId: string }> }
) {
  const { gameSessionId } = await params;
  const session = getSession(gameSessionId);
  if (!session) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (session.status !== "finished") {
    return NextResponse.json({ error: "Game not finished" }, { status: 400 });
  }

  if (!session.betId) {
    return NextResponse.json({ error: "No bet associated" }, { status: 400 });
  }

  if (session.resultReported) {
    return NextResponse.json({ message: "Result already reported" });
  }

  const body = await request.json();
  const { apiKey } = body;

  if (!apiKey) {
    return NextResponse.json({ error: "apiKey required" }, { status: 400 });
  }

  // Determine the winner's userId from the game session
  const winnerUserId =
    session.winner === "A" ? session.playerAId
    : session.winner === "B" ? session.playerBId
    : null; // draw

  // Look up the bet to map the winner's userId to the correct bet player
  // (bet.playerAId may differ from session.playerAId if a different player created the bet)
  let outcome: string;
  if (session.winner === "draw" || !winnerUserId) {
    outcome = "DRAW";
  } else {
    const bet = await prisma.bet.findUnique({
      where: { id: session.betId },
      select: { playerAId: true, playerBId: true },
    });

    if (!bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (winnerUserId === bet.playerAId) {
      outcome = "PLAYER_A_WIN";
    } else if (winnerUserId === bet.playerBId) {
      outcome = "PLAYER_B_WIN";
    } else {
      console.error("[RESULT] Winner userId not found in bet players", {
        winnerUserId,
        betPlayerAId: bet.playerAId,
        betPlayerBId: bet.playerBId,
        sessionId: gameSessionId,
      });
      return NextResponse.json(
        { error: "Winner not a participant in this bet" },
        { status: 400 }
      );
    }

    console.log("[RESULT]", {
      gameSessionId,
      gameWinner: session.winner,
      winnerUserId,
      betPlayerAId: bet.playerAId,
      betPlayerBId: bet.playerBId,
      outcome,
    });
  }

  // Call PlayStake API to report result (server-to-server)
  const baseUrl = request.nextUrl.origin;
  const res = await fetch(`${baseUrl}/api/v1/bets/${session.betId}/result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      outcome,
      idempotencyKey: `demo_${gameSessionId}_${Date.now()}`,
      resultPayload: {
        board: session.board,
        winner: session.winner,
        winnerUserId,
        gameSessionId,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to report result", details: data },
      { status: res.status }
    );
  }

  session.resultReported = true;
  return NextResponse.json({ success: true, betResult: data });
}
