import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../store";

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

  // Map game winner to PlayStake outcome
  let outcome: string;
  if (session.winner === "A") outcome = "PLAYER_A_WIN";
  else if (session.winner === "B") outcome = "PLAYER_B_WIN";
  else outcome = "DRAW";

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
