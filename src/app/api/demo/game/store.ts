// In-memory game session store (demo only — not for production)

export type GameType = 'tictactoe' | 'cards';

export interface GameSession {
  id: string;
  betId: string | null;
  board?: (string | null)[]; // 9 cells: null, 'X', or 'O' — only for tictactoe
  turn?: "A" | "B"; // only for tictactoe
  playerAId: string;
  playerBId: string | null;
  status: "waiting" | "playing" | "finished";
  winner: "A" | "B" | "draw" | null;
  resultReported: boolean;
  createdAt: number;
  gameType: GameType;
  gameData: Record<string, unknown>;
}

// Survive Next.js hot reloads in dev
const globalForSessions = globalThis as unknown as {
  __demoGameSessions?: Map<string, GameSession>;
};
const sessions =
  globalForSessions.__demoGameSessions ??
  (globalForSessions.__demoGameSessions = new Map<string, GameSession>());

export function createSession(
  playerAId: string,
  betId: string | null,
  gameType: GameType = 'tictactoe',
  explicitId?: string
): GameSession {
  // Idempotent when an explicit id is provided: if a session already exists
  // with that id, return it unchanged. This lets both lobby-matched players
  // POST /api/demo/game with the same deterministic session id without the
  // second caller clobbering the first.
  if (explicitId) {
    const existing = sessions.get(explicitId);
    if (existing) return existing;
  }

  const id = explicitId ?? Math.random().toString(36).slice(2, 8).toUpperCase();
  const session: GameSession = {
    id,
    betId,
    playerAId,
    playerBId: null,
    status: "waiting",
    winner: null,
    resultReported: false,
    createdAt: Date.now(),
    gameType,
    gameData: {},
  };

  // Only init board/turn for tictactoe
  if (gameType === 'tictactoe') {
    session.board = Array(9).fill(null);
    session.turn = "A";
  }

  sessions.set(id, session);
  return session;
}

export function getSession(id: string): GameSession | undefined {
  return sessions.get(id);
}

export function listWaitingSessions(): GameSession[] {
  return Array.from(sessions.values()).filter((s) => s.status === "waiting");
}

// Check win condition: returns 'X', 'O', 'draw', or null
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diags
];

export function checkWinner(board: (string | null)[]): string | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // 'X' or 'O'
    }
  }
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
}

export function makeMove(
  session: GameSession,
  cell: number,
  player: "A" | "B"
): { success: boolean; error?: string } {
  if (session.status !== "playing") {
    return { success: false, error: "Game is not in progress" };
  }
  if (session.turn !== player) {
    return { success: false, error: "Not your turn" };
  }
  if (!session.board || cell < 0 || cell > 8 || session.board[cell] !== null) {
    return { success: false, error: "Invalid cell" };
  }

  session.board[cell] = player === "A" ? "X" : "O";

  const result = checkWinner(session.board);
  if (result) {
    session.status = "finished";
    if (result === "X") session.winner = "A";
    else if (result === "O") session.winner = "B";
    else session.winner = "draw";
  } else {
    session.turn = player === "A" ? "B" : "A";
  }

  return { success: true };
}

export function joinSession(
  session: GameSession,
  playerBId: string,
  betId?: string
): void {
  session.playerBId = playerBId;
  if (betId) session.betId = betId;
  session.status = "playing";
}

export function resolveGame(
  session: GameSession,
  winner: "A" | "B" | "draw"
): { success: boolean; error?: string } {
  if (session.status !== "playing") {
    return { success: false, error: "Game is not in progress" };
  }
  if (session.gameType === 'tictactoe') {
    return { success: false, error: "Tic-tac-toe games resolve via moves, not directly" };
  }
  session.status = "finished";
  session.winner = winner;
  return { success: true };
}
