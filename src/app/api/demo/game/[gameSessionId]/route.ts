import { NextRequest, NextResponse } from "next/server";
import { getSession, makeMove, joinSession } from "../store";

// GET /api/demo/game/:id — Get game state (polled by both tabs)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameSessionId: string }> }
) {
  const { gameSessionId } = await params;
  const session = getSession(gameSessionId);
  if (!session) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}

// PATCH /api/demo/game/:id — Make a move or join
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameSessionId: string }> }
) {
  const { gameSessionId } = await params;
  const session = getSession(gameSessionId);
  if (!session) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const body = await request.json();

  // Join action
  if (body.action === "join") {
    if (session.status !== "waiting") {
      return NextResponse.json({ error: "Game already started" }, { status: 400 });
    }
    if (body.playerBId === session.playerAId) {
      return NextResponse.json({ error: "Cannot play against yourself" }, { status: 400 });
    }
    joinSession(session, body.playerBId, body.betId);
    return NextResponse.json(session);
  }

  // Set betId action (sync widget betId back to game session)
  if (body.action === "setBetId") {
    if (!body.betId) {
      return NextResponse.json({ error: "betId required" }, { status: 400 });
    }
    session.betId = body.betId;
    return NextResponse.json(session);
  }

  // Move action
  if (body.action === "move") {
    const result = makeMove(session, body.cell, body.player);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(session);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
