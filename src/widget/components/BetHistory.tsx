import React from "react";
import type { BetData } from "../types";
import { formatCents } from "../utils";

interface BetHistoryProps {
  bets: BetData[];
}

/**
 * Compact list of recent settled bets (last 5).
 * Shows outcome indicator (won/lost/draw) and amounts.
 */
export function BetHistory({ bets }: BetHistoryProps) {
  if (bets.length === 0) return null;

  return (
    <div className="ps-history">
      <h4 className="ps-section-title">Recent Bets</h4>
      <ul className="ps-history__list" role="list">
        {bets.map((bet) => {
          const outcomeClass = getOutcomeClass(bet);
          const outcomeLabel = getOutcomeLabel(bet);
          const timeAgo = getTimeAgo(bet.settledAt || bet.createdAt);

          return (
            <li key={bet.betId} className="ps-history__item">
              <div className="ps-history__left">
                <span className={`ps-history__indicator ${outcomeClass}`} aria-label={outcomeLabel} />
                <div className="ps-history__details">
                  <span className="ps-history__opponent">
                    vs {bet.playerB?.displayName || bet.playerA?.displayName || "---"}
                  </span>
                  <span className="ps-history__time">{timeAgo}</span>
                </div>
              </div>
              <div className="ps-history__right">
                <span className={`ps-history__amount ${outcomeClass}`}>
                  {outcomeLabel === "Won" ? "+" : outcomeLabel === "Lost" ? "-" : ""}
                  {formatCents(bet.amount)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function getOutcomeClass(bet: BetData): string {
  if (bet.status === "CANCELLED" || bet.status === "VOIDED") return "ps-history--neutral";
  if (!bet.outcome) return "ps-history--neutral";
  if (bet.outcome === "DRAW") return "ps-history--draw";

  // Determine if the current player won (we don't know the player ID in widget
  // context, so rely on the API's myRole/netResult if available, otherwise
  // just show the outcome label).
  // For now, show based on outcome string:
  if (bet.outcome === "PLAYER_A_WIN") return "ps-history--won";
  if (bet.outcome === "PLAYER_B_WIN") return "ps-history--lost";
  return "ps-history--neutral";
}

function getOutcomeLabel(bet: BetData): string {
  if (bet.status === "CANCELLED") return "Cancelled";
  if (bet.status === "VOIDED") return "Voided";
  if (!bet.outcome) return "Pending";
  if (bet.outcome === "DRAW") return "Draw";
  if (bet.outcome === "PLAYER_A_WIN") return "Won";
  if (bet.outcome === "PLAYER_B_WIN") return "Lost";
  return bet.outcome;
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
