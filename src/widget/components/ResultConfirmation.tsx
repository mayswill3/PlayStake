import React, { useState, useCallback } from "react";
import type { BetData, BetOutcome } from "../types";
import { formatCents } from "../utils";

interface ResultConfirmationProps {
  bet: BetData;
  onConfirm: (betId: string, outcome: BetOutcome) => Promise<boolean>;
  onDispute: (betId: string, reason: string) => Promise<boolean>;
}

/**
 * Shown when a bet has RESULT_REPORTED status and the player needs to
 * confirm or dispute the reported outcome.
 *
 * Confirm sends the widget-result to the dual-source verification endpoint.
 * Dispute files a dispute with a reason.
 */
export function ResultConfirmation({
  bet,
  onConfirm,
  onDispute,
}: ResultConfirmationProps) {
  const [mode, setMode] = useState<"prompt" | "dispute" | "processing">("prompt");
  const [disputeReason, setDisputeReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!bet.outcome) return;
    setMode("processing");
    setError(null);

    const success = await onConfirm(bet.betId, bet.outcome as BetOutcome);
    if (!success) {
      setMode("prompt");
      setError("Failed to confirm result. Please try again.");
    }
  }, [bet.betId, bet.outcome, onConfirm]);

  const handleDispute = useCallback(async () => {
    if (!disputeReason.trim()) {
      setError("Please provide a reason for the dispute.");
      return;
    }

    setMode("processing");
    setError(null);

    const success = await onDispute(bet.betId, disputeReason.trim());
    if (!success) {
      setMode("dispute");
      setError("Failed to file dispute. Please try again.");
    }
  }, [bet.betId, disputeReason, onDispute]);

  const isProcessing = mode === "processing";

  return (
    <div className="ps-result" role="alertdialog" aria-label="Match result confirmation">
      <div className="ps-result__header">
        <h4 className="ps-section-title">Match Result</h4>
      </div>

      <div className="ps-result__outcome">
        <span className="ps-result__outcome-label">Reported Outcome</span>
        <span className="ps-result__outcome-value">
          {formatOutcome(bet.outcome)}
        </span>
        <span className="ps-result__amount">
          Bet: {formatCents(bet.amount)} per player
        </span>
      </div>

      {error && (
        <div className="ps-error" role="alert">
          {error}
        </div>
      )}

      {mode === "dispute" ? (
        <div className="ps-result__dispute-form">
          <label className="ps-label" htmlFor="ps-dispute-reason">
            Why are you disputing this result?
          </label>
          <textarea
            id="ps-dispute-reason"
            className="ps-textarea"
            rows={3}
            placeholder="Describe what happened..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            maxLength={500}
          />
          <div className="ps-result__actions">
            <button
              className="ps-btn ps-btn--secondary"
              onClick={() => {
                setMode("prompt");
                setError(null);
              }}
            >
              Cancel
            </button>
            <button
              className="ps-btn ps-btn--danger"
              onClick={handleDispute}
              disabled={!disputeReason.trim()}
            >
              Submit Dispute
            </button>
          </div>
        </div>
      ) : (
        <div className="ps-result__actions">
          <button
            className="ps-btn ps-btn--danger ps-btn--outline"
            onClick={() => setMode("dispute")}
            disabled={isProcessing}
          >
            Dispute
          </button>
          <button
            className="ps-btn ps-btn--primary"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <span className="ps-btn__loading">
                <span className="ps-spinner ps-spinner--small" />
                Confirming...
              </span>
            ) : (
              "Confirm Result"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function formatOutcome(outcome: string | null): string {
  switch (outcome) {
    case "PLAYER_A_WIN":
      return "Player A Wins";
    case "PLAYER_B_WIN":
      return "Player B Wins";
    case "DRAW":
      return "Draw";
    default:
      return "Unknown";
  }
}
