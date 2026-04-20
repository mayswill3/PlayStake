export type PlayerRole = 'A' | 'B';
export type DemoPhase = 'role-select' | 'setup' | 'lobby' | 'playing' | 'finished';
export type GameType = 'tictactoe' | 'cards' | 'darts';

export interface DemoAuthState {
  playerId: string;
  apiKey: string;
  gameId: string;
  widgetToken: string;
  displayName: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'error' | 'bet';
}
