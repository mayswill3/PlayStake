// ---------------------------------------------------------------------------
// Widget types — shared across hooks and components
// ---------------------------------------------------------------------------

export interface WidgetConfig {
  token: string;
  gameId: string;
  theme: "dark" | "light" | "auto";
  instanceId: string;
  apiBaseUrl: string;
}

export interface BalanceData {
  available: number; // cents
  escrowed: number; // cents
  currency: string;
}

export interface PlayerInfo {
  id: string;
  displayName: string;
}

export interface BetData {
  betId: string;
  externalId?: string;
  gameId: string;
  status: BetStatus;
  amount: number; // cents
  currency: string;
  playerA: PlayerInfo | null;
  playerB: PlayerInfo | null;
  outcome: BetOutcome | null;
  resultVerified: boolean;
  platformFeeAmount: number | null;
  gameMetadata: Record<string, unknown> | null;
  createdAt: string;
  matchedAt: string | null;
  expiresAt: string | null;
  resultReportedAt: string | null;
  settledAt: string | null;
}

export type BetStatus =
  | "PENDING_CONSENT"
  | "OPEN"
  | "MATCHED"
  | "RESULT_REPORTED"
  | "SETTLED"
  | "CANCELLED"
  | "VOIDED"
  | "DISPUTED";

export type BetOutcome = "PLAYER_A_WIN" | "PLAYER_B_WIN" | "DRAW";

export interface CreateBetParams {
  amount: number; // cents
  opponentId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PostMessageEvent {
  source: string;
  instanceId?: string;
  type: string;
  payload?: unknown;
}

export interface WidgetAuthState {
  status: "loading" | "authenticated" | "error" | "unlinked";
  playerId: string | null;
  gameId: string | null;
  error: string | null;
}

export interface ApiError {
  error: string;
  code?: string;
}
