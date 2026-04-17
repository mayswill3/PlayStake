import { NextRequest, NextResponse } from "next/server";
import { createSession, listWaitingSessions } from "./store";
import type { GameType } from "./store";

// POST /api/demo/game — Create a new game session
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { playerAId, betId, gameType, sessionId } = body;

  if (!playerAId) {
    return NextResponse.json({ error: "playerAId required" }, { status: 400 });
  }

  const validTypes: GameType[] = ['tictactoe', 'cards', 'darts', 'pool'];
  const type: GameType = validTypes.includes(gameType) ? gameType : 'tictactoe';

  // Optional explicit session id — used by the lobby match handoff to derive
  // a deterministic, shared session id from betId so both players land on the
  // same board-state session without an extra coordination step.
  const explicitId = typeof sessionId === "string" && sessionId.length > 0 ? sessionId : undefined;

  const session = createSession(playerAId, betId ?? null, type, explicitId);
  return NextResponse.json(session, { status: 201 });
}

// GET /api/demo/game — List waiting game sessions
export async function GET() {
  const sessions = listWaitingSessions();
  return NextResponse.json({ sessions });
}
