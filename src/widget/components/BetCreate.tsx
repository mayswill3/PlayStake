import React, { useState, useCallback } from "react";
import type { BalanceData, CreateBetParams, BetData } from "../types";
import { formatCents } from "../utils";

interface BetCreateProps {
  balance: BalanceData | null;
  onCreateBet: (params: CreateBetParams) => Promise<BetData | null>;
  onConsentBet: (betId: string) => Promise<BetData | null>;
  minBet?: number; // cents, default 100 ($1)
  maxBet?: number; // cents, default 100000 ($1000)
  disabled?: boolean;
}

const PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000]; // in cents

/**
 * Form for creating a new bet challenge.
 *
 * Shows preset amount buttons and a custom input field.
 * Confirms with the player before locking escrow.
 * Handles the two-step flow: create bet (PENDING_CONSENT) then consent (escrow).
 */
export function BetCreate({
  balance,
  onCreateBet,
  onConsentBet,
  minBet = 100,
  maxBet = 100000,
  disabled = false,
}: BetCreateProps) {
  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState("");
  const [step, setStep] = useState<"select" | "confirm" | "processing">("select");
  const [error, setError] = useState<string | null>(null);

  const availableBalance = balance?.available ?? 0;

  const handlePresetClick = useCallback((preset: number) => {
    setAmount(preset);
    setCustomAmount("");
    setError(null);
  }, []);

  const handleCustomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9.]/g, "");
      setCustomAmount(raw);
      const cents = Math.round(parseFloat(raw) * 100);
      if (!isNaN(cents) && cents > 0) {
        setAmount(cents);
      } else {
        setAmount(0);
      }
      setError(null);
    },
    []
  );

  const handleConfirmStep = useCallback(() => {
    if (amount < minBet) {
      setError(`Minimum bet is ${formatCents(minBet)}`);
      return;
    }
    if (amount > maxBet) {
      setError(`Maximum bet is ${formatCents(maxBet)}`);
      return;
    }
    if (amount > availableBalance) {
      setError("Insufficient balance");
      return;
    }
    setStep("confirm");
  }, [amount, minBet, maxBet, availableBalance]);

  const handleSubmit = useCallback(async () => {
    setStep("processing");
    setError(null);

    // Step 1: Create the bet (PENDING_CONSENT)
    const bet = await onCreateBet({ amount });
    if (!bet) {
      setStep("confirm");
      return;
    }

    // Step 2: Consent to lock escrow
    const consentResult = await onConsentBet(bet.betId);
    if (!consentResult) {
      setStep("confirm");
      return;
    }

    // Success — reset form
    setStep("select");
    setAmount(0);
    setCustomAmount("");
  }, [amount, onCreateBet, onConsentBet]);

  const handleBack = useCallback(() => {
    setStep("select");
    setError(null);
  }, []);

  if (step === "confirm" || step === "processing") {
    const isProcessing = step === "processing";
    return (
      <div className="ps-bet-create">
        <div className="ps-bet-create__confirm">
          <h4 className="ps-bet-create__confirm-title">Confirm Challenge</h4>
          <div className="ps-bet-create__confirm-amount">{formatCents(amount)}</div>
          <p className="ps-bet-create__confirm-text">
            This amount will be locked in escrow until the bet is settled or
            cancelled.
          </p>
          {error && (
            <div className="ps-error" role="alert">
              {error}
            </div>
          )}
          <div className="ps-bet-create__actions">
            <button
              className="ps-btn ps-btn--secondary"
              onClick={handleBack}
              disabled={isProcessing}
            >
              Back
            </button>
            <button
              className="ps-btn ps-btn--primary"
              onClick={handleSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <span className="ps-btn__loading">
                  <span className="ps-spinner ps-spinner--small" />
                  Locking Funds...
                </span>
              ) : (
                "Lock & Challenge"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-bet-create">
      <h4 className="ps-section-title">Create Challenge</h4>

      <div className="ps-bet-create__presets" role="group" aria-label="Preset amounts">
        {PRESET_AMOUNTS.filter((p) => p >= minBet && p <= maxBet).map((preset) => (
          <button
            key={preset}
            className={`ps-bet-create__preset ${amount === preset ? "ps-bet-create__preset--active" : ""}`}
            onClick={() => handlePresetClick(preset)}
            disabled={disabled || preset > availableBalance}
            aria-pressed={amount === preset}
          >
            {formatCents(preset)}
          </button>
        ))}
      </div>

      <div className="ps-bet-create__custom">
        <label className="ps-label" htmlFor="ps-custom-amount">
          Custom Amount
        </label>
        <div className="ps-input-group">
          <span className="ps-input-group__prefix">$</span>
          <input
            id="ps-custom-amount"
            type="text"
            inputMode="decimal"
            className="ps-input"
            placeholder="0.00"
            value={customAmount}
            onChange={handleCustomChange}
            disabled={disabled}
            aria-describedby="ps-amount-range"
          />
        </div>
        <span id="ps-amount-range" className="ps-hint">
          {formatCents(minBet)} - {formatCents(maxBet)}
        </span>
      </div>

      {error && (
        <div className="ps-error" role="alert">
          {error}
        </div>
      )}

      <button
        className="ps-btn ps-btn--primary ps-btn--full"
        onClick={handleConfirmStep}
        disabled={disabled || amount === 0}
      >
        Continue
      </button>
    </div>
  );
}
