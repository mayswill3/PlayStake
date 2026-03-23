import React from "react";
import type { WidgetAuthState } from "../types";

interface WidgetAuthProps {
  authState: WidgetAuthState;
}

/**
 * Displays the widget's authentication state:
 * - Loading spinner while validating the token
 * - Error message if the token is invalid or expired
 * - "Connect Account" link if the player hasn't linked their PlayStake account
 */
export function WidgetAuth({ authState }: WidgetAuthProps) {
  if (authState.status === "loading") {
    return (
      <div className="ps-auth ps-auth--loading" role="status" aria-label="Authenticating">
        <div className="ps-spinner" />
        <p className="ps-auth__text">Connecting to PlayStake...</p>
      </div>
    );
  }

  if (authState.status === "unlinked") {
    return (
      <div className="ps-auth ps-auth--unlinked">
        <div className="ps-auth__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <h3 className="ps-auth__title">Account Not Linked</h3>
        <p className="ps-auth__text">
          Connect your PlayStake account to start betting.
        </p>
        <a
          href="/connect"
          target="_blank"
          rel="noopener noreferrer"
          className="ps-btn ps-btn--primary"
        >
          Connect PlayStake Account
        </a>
      </div>
    );
  }

  if (authState.status === "error") {
    return (
      <div className="ps-auth ps-auth--error" role="alert">
        <div className="ps-auth__icon ps-auth__icon--error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="ps-auth__title">Connection Error</h3>
        <p className="ps-auth__text">
          {authState.error || "Unable to authenticate. Please try again."}
        </p>
        <button
          className="ps-btn ps-btn--secondary"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return null;
}
