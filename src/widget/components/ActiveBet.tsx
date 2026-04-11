import React from "react";
import type { BetData } from "../types";
import { formatCents, getGameDisplayName } from "../utils";

interface ActiveBetProps {
  bet: BetData;
  onConfirmResult: (betId: string, outcome: string) => void;
  onConsent?: (betId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONSENT: "Awaiting Consent",
  OPEN: "Waiting for Opponent",
  MATCHED: "In Progress",
  RESULT_REPORTED: "Result Reported",
  DISPUTED: "Disputed",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_CONSENT: "ps-status--warning",
  OPEN: "ps-status--info",
  MATCHED: "ps-status--active",
  RESULT_REPORTED: "ps-status--pending",
  DISPUTED: "ps-status--danger",
};

/**
 * Shows the current active/matched bet.
 * Displays status indicator, both players, amount, and game state.
 * When a result is reported, shows a prompt to confirm via widget-result.
 */
export function ActiveBet({ bet, onConfirmResult, onConsent }: ActiveBetProps) {
  const [consenting, setConsenting] = React.useState(false);
  const statusLabel = STATUS_LABELS[bet.status] || bet.status;
  const statusClass = STATUS_COLORS[bet.status] || "";
  const showResultConfirm = bet.status === "RESULT_REPORTED" && bet.outcome && !bet.resultVerified;
  const showConsent = bet.status === "PENDING_CONSENT" && onConsent;

  // Derive a clean, user-facing info line from the bet's metadata. Never
  // render raw gameMetadata key/value pairs — that's how debug strings like
  // "source: lobby" and "gameType: bullseye" used to leak into the UI.
  const rawGameType =
    (bet.gameMetadata as { gameType?: string } | null)?.gameType ?? null;
  const gameName = getGameDisplayName(rawGameType);
  const totalPot = formatCents(bet.amount * 2);

  return (
    <div className="ps-active-bet">
      <div className="ps-active-bet__header">
        <h4 className="ps-section-title">Active Bet</h4>
        <span className={`ps-status ${statusClass}`} role="status">
          <span className="ps-status__dot" />
          {statusLabel}
        </span>
      </div>

      <div className="ps-active-bet__card">
        <div className="ps-active-bet__amount">{formatCents(bet.amount)}</div>
        <div className="ps-active-bet__versus">per player</div>

        <div className="ps-active-bet__players">
          <div className="ps-active-bet__player">
            <span className="ps-active-bet__player-label">Player A</span>
            <span className="ps-active-bet__player-name">
              {bet.playerA?.displayName || "---"}
            </span>
          </div>
          <span className="ps-active-bet__vs">VS</span>
          <div className="ps-active-bet__player">
            <span className="ps-active-bet__player-label">Player B</span>
            <span className="ps-active-bet__player-name">
              {bet.playerB?.displayName || "Waiting..."}
            </span>
          </div>
        </div>

        {showConsent && (
          <div className="ps-active-bet__result-prompt" style={{ marginTop: 12 }}>
            <p className="ps-active-bet__result-text">
              Confirm to lock <strong>{formatCents(bet.amount)}</strong> in escrow
            </p>
            <div className="ps-active-bet__result-actions" style={{ marginTop: 8 }}>
              <button
                className="ps-btn ps-btn--primary"
                disabled={consenting}
                onClick={async () => {
                  setConsenting(true);
                  await onConsent(bet.betId);
                  setConsenting(false);
                }}
              >
                {consenting ? (
                  <span className="ps-btn__loading">
                    <span className="ps-spinner ps-spinner--small" />
                    Locking...
                  </span>
                ) : (
                  "Confirm & Lock Funds"
                )}
              </button>
            </div>
          </div>
        )}

        {gameName && (
          <div className="ps-active-bet__info">
            {gameName} &middot; {totalPot} total pot
          </div>
        )}
      </div>

      {showResultConfirm && (
        <div className="ps-active-bet__result-prompt" role="alert">
          <p className="ps-active-bet__result-text">
            Result reported: <strong>{formatOutcome(bet.outcome!)}</strong>
          </p>
          <p className="ps-hint">Please confirm or dispute this result.</p>
          <div className="ps-active-bet__result-actions">
            <button
              className="ps-btn ps-btn--primary"
              onClick={() => onConfirmResult(bet.betId, bet.outcome!)}
            >
              Confirm Result
            </button>
            <button
              className="ps-btn ps-btn--danger"
              onClick={() => onConfirmResult(bet.betId, "__DISPUTE__")}
            >
              Dispute
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatOutcome(outcome: string): string {
  switch (outcome) {
    case "PLAYER_A_WIN":
      return "Player A Wins";
    case "PLAYER_B_WIN":
      return "Player B Wins";
    case "DRAW":
      return "Draw";
    default:
      return outcome;
  }
}
