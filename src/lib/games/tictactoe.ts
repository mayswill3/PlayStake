// =============================================================================
// PlayStake — Tic-tac-toe rules
// =============================================================================

export interface TicTacToeState {
  board: (string | null)[];
  turn: "A" | "B";
}

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function initialTicTacToe(): TicTacToeState {
  return { board: Array(9).fill(null), turn: "A" };
}

/** 'X', 'O', 'draw', or null while the game is still open. */
export function checkWinner(board: (string | null)[]): string | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
}

export function applyMove(
  state: TicTacToeState,
  cell: number,
  player: "A" | "B",
): { state: TicTacToeState; winner: "A" | "B" | "draw" | null } {
  if (state.turn !== player) throw new Error("Not your turn");
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || state.board[cell] !== null) {
    throw new Error("Invalid cell");
  }
  const board = [...state.board];
  board[cell] = player === "A" ? "X" : "O";
  const result = checkWinner(board);
  const winner = result === "X" ? "A" : result === "O" ? "B" : result === "draw" ? "draw" : null;
  return { state: { board, turn: winner ? state.turn : player === "A" ? "B" : "A" }, winner };
}
