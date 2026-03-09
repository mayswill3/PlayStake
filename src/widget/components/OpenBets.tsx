import React, { useState, useCallback } from "react";
import type { BetData } from "../types";
import { formatCents, timeRemaining } from "../utils";

interface OpenBetsProps {
  bets: BetData[];
  loading: boolean;
  onAccept: (betId: string) => Promise<BetData | null>;
}

/**
 * Lists open bets for this game that the player can accept.
 * Each bet shows: creator name, amount, time remaining, and an Accept button.
 */
export function OpenBets({ bets, loading, onAccept }: OpenBetsProps) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const handleAccept = useCallback(
    async (betId: string) => {
      setAcceptingId(betId);
      await onAccept(betId);
      setAcceptingId(null);
    },
    [onAccept]
  );

  if (loading && bets.length === 0) {
    return (
      <div className="ps-open-bets">
        <h4 className="ps-section-title">Open Challenges</h4>
        <div className="ps-empty" role="status">
          <span className="ps-spinner ps-spinner--small" />
          <span>Loading challenges...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-open-bets">
      <h4 className="ps-section-title">
        Open Challenges
        {bets.length > 0 && (
          <span className="ps-badge">{bets.length}</span>
        )}
      </h4>

      {bets.length === 0 ? (
        <div className="ps-empty">
          <p>No open challenges right now.</p>
          <p className="ps-hint">Create one above or wait for opponents.</p>
        </div>
      ) : (
        <ul className="ps-open-bets__list" role="list">
          {bets.map((bet) => {
            const isAccepting = acceptingId === bet.betId;
            const remaining = bet.expiresAt ? timeRemaining(bet.expiresAt) : null;

            return (
              <li key={bet.betId} className="ps-open-bets__item">
                <div className="ps-open-bets__info">
                  <span className="ps-open-bets__player">
                    {bet.playerA?.displayName || "Anonymous"}
                  </span>
                  <span className="ps-open-bets__amount">
                    {formatCents(bet.amount)}
                  </span>
                </div>
                <div className="ps-open-bets__meta">
                  {remaining && (
                    <span className="ps-open-bets__time" aria-label="Time remaining">
                      {remaining}
                    </span>
                  )}
                  <button
                    className="ps-btn ps-btn--accent ps-btn--small"
                    onClick={() => handleAccept(bet.betId)}
                    disabled={isAccepting}
                    aria-label={`Accept ${formatCents(bet.amount)} challenge from ${bet.playerA?.displayName || "Anonymous"}`}
                  >
                    {isAccepting ? (
                      <span className="ps-btn__loading">
                        <span className="ps-spinner ps-spinner--tiny" />
                      </span>
                    ) : (
                      "Accept"
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
