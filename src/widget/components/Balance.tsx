import React from "react";
import type { BalanceData } from "../types";
import { formatCents } from "../utils";

interface BalanceProps {
  balance: BalanceData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Compact balance display showing available and escrowed funds.
 * Designed for the small widget header area.
 */
export function Balance({ balance, loading, error }: BalanceProps) {
  if (loading && !balance) {
    return (
      <div className="ps-balance ps-balance--loading" aria-label="Loading balance">
        <div className="ps-balance__row">
          <span className="ps-balance__label">Available</span>
          <span className="ps-balance__value ps-skeleton">--</span>
        </div>
      </div>
    );
  }

  if (error && !balance) {
    return (
      <div className="ps-balance ps-balance--error" role="alert">
        <span className="ps-balance__error">Unable to load balance</span>
      </div>
    );
  }

  if (!balance) return null;

  return (
    <div className="ps-balance" aria-label="Wallet balance">
      <div className="ps-balance__row">
        <span className="ps-balance__label">Available</span>
        <span className="ps-balance__value ps-balance__value--available">
          {formatCents(balance.available)}
        </span>
      </div>
      {balance.escrowed > 0 && (
        <div className="ps-balance__row">
          <span className="ps-balance__label">In Bets</span>
          <span className="ps-balance__value ps-balance__value--escrowed">
            {formatCents(balance.escrowed)}
          </span>
        </div>
      )}
    </div>
  );
}
