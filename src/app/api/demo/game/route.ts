import { NextRequest, NextResponse } from "next/server";
import { createSession, listWaitingSessions } from "./store";

// POST /api/demo/game — Create a new game session
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { playerAId, betId } = body;

  if (!playerAId) {
    return NextResponse.json({ error: "playerAId required" }, { status: 400 });
  }

  const session = createSession(playerAId, betId ?? null);
  return NextResponse.json(session, { status: 201 });
}

// GET /api/demo/game — List waiting game sessions
export async function GET() {
  const sessions = listWaitingSessions();
  return NextResponse.json({ sessions });
}
