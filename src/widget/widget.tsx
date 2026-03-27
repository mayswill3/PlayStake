import React, { useState, useCallback, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { WidgetConfig, BetOutcome } from "./types";
import { parseWidgetParams } from "./utils";
import { useWidgetAuth } from "./hooks/useWidgetAuth";
import { useBalance } from "./hooks/useBalance";
import { useBets } from "./hooks/useBets";
import { usePostMessage } from "./hooks/usePostMessage";
import { WidgetAuth } from "./components/WidgetAuth";
import { Balance } from "./components/Balance";
import { BetCreate } from "./components/BetCreate";
import { OpenBets } from "./components/OpenBets";
import { ActiveBet } from "./components/ActiveBet";
import { BetHistory } from "./components/BetHistory";
import { ResultConfirmation } from "./components/ResultConfirmation";

// ---------------------------------------------------------------------------
// Determine the API base URL.
// In production, the widget is on widget.playstake.com and the API is on
// playstake.com. In dev, both run on localhost (different ports).
// ---------------------------------------------------------------------------
const API_BASE_URL =
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("apiBaseUrl")) ||
  (typeof window !== "undefined"
    ? window.location.origin
    : "");

// ---------------------------------------------------------------------------
// Widget App
// ---------------------------------------------------------------------------

type Tab = "bets" | "history";

function WidgetApp() {
  const params = parseWidgetParams();
  const [activeTab, setActiveTab] = useState<Tab>("bets");

  const config: WidgetConfig = useMemo(
    () => ({
      token: params.token,
      gameId: params.gameId,
      theme: params.theme,
      instanceId: params.instanceId,
      apiBaseUrl: API_BASE_URL,
    }),
    [params.token, params.gameId, params.theme, params.instanceId]
  );

  // Auth
  const { authState, authFetch } = useWidgetAuth(config);
  const isAuthenticated = authState.status === "authenticated";

  // Balance
  const {
    balance,
    loading: balanceLoading,
    error: balanceError,
    refresh: refreshBalance,
  } = useBalance(authFetch, isAuthenticated);

  // Bets
  const {
    openBets,
    activeBet,
    recentBets,
    loading: betsLoading,
    error: betsError,
    createBet,
    consentBet,
    acceptBet,
    confirmResult,
    disputeResult,
    refresh: refreshBets,
  } = useBets({
    authFetch,
    gameId: config.gameId,
    isAuthenticated,
    onBalanceChange: refreshBalance,
  });

  // PostMessage bridge — use a ref to avoid circular dependency between
  // the onCreateBet callback and the sendBetCreated return value.
  const sendBetCreatedRef = useRef<((bet: any) => void) | null>(null);

  const { sendBetCreated, sendBetAccepted, sendBetSettled, sendError } =
    usePostMessage({
      instanceId: config.instanceId,
      onCreateBet: useCallback(
        (payload: { amount: number; opponentId?: string; metadata?: Record<string, unknown> }) => {
          createBet({
            amount: payload.amount,
            opponentId: payload.opponentId,
            metadata: payload.metadata,
          }).then((bet) => {
            if (bet && sendBetCreatedRef.current) sendBetCreatedRef.current(bet);
          });
        },
        [createBet]
      ),
      onRefreshBalance: useCallback(() => {
        refreshBalance();
        refreshBets();
      }, [refreshBalance, refreshBets]),
    });

  sendBetCreatedRef.current = sendBetCreated;

  // Wrap bet actions to also send postMessage events
  const handleCreateBet = useCallback(
    async (params: { amount: number; opponentId?: string | null; metadata?: Record<string, unknown> | null }) => {
      const bet = await createBet(params);
      if (bet) sendBetCreated(bet);
      else sendError({ code: "CREATE_FAILED", message: betsError || "Failed to create bet" });
      return bet;
    },
    [createBet, sendBetCreated, sendError, betsError]
  );

  const handleAcceptBet = useCallback(
    async (betId: string) => {
      const bet = await acceptBet(betId);
      if (bet) sendBetAccepted(bet as any);
      else sendError({ code: "ACCEPT_FAILED", message: betsError || "Failed to accept bet" });
      return bet;
    },
    [acceptBet, sendBetAccepted, sendError, betsError]
  );

  const handleConfirmResult = useCallback(
    async (betId: string, outcomeOrDispute: string) => {
      if (outcomeOrDispute === "__DISPUTE__") {
        // Switch to the ResultConfirmation component's dispute mode.
        // The component handles this internally.
        return;
      }
      const success = await confirmResult(betId, outcomeOrDispute as BetOutcome);
      if (success && activeBet) {
        sendBetSettled(activeBet);
      }
    },
    [confirmResult, activeBet, sendBetSettled]
  );

  // Apply theme
  const themeClass = config.theme === "light" ? "ps-widget--light" : "ps-widget--dark";

  // ---- Not authenticated ----
  if (!isAuthenticated) {
    return (
      <div className={`ps-widget ${themeClass}`}>
        <WidgetAuth authState={authState} />
      </div>
    );
  }

  // ---- Active bet with result needing confirmation ----
  const showResultConfirmation =
    activeBet &&
    activeBet.status === "RESULT_REPORTED" &&
    activeBet.outcome &&
    !activeBet.resultVerified;

  return (
    <div className={`ps-widget ${themeClass}`}>
      {/* Header */}
      <header className="ps-widget__header">
        <div className="ps-widget__logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>PlayStake</span>
        </div>
        <Balance balance={balance} loading={balanceLoading} error={balanceError} />
      </header>

      {/* Error banner */}
      {betsError && (
        <div className="ps-widget__error" role="alert">
          {betsError}
        </div>
      )}

      {/* Result confirmation overlay */}
      {showResultConfirmation && (
        <ResultConfirmation
          bet={activeBet!}
          onConfirm={confirmResult}
          onDispute={disputeResult}
        />
      )}

      {/* Active bet banner */}
      {activeBet && !showResultConfirmation && (
        <ActiveBet bet={activeBet} onConfirmResult={handleConfirmResult} onConsent={consentBet} />
      )}

      {/* Tab navigation */}
      <nav className="ps-tabs" role="tablist" aria-label="Widget sections">
        <button
          className={`ps-tabs__tab ${activeTab === "bets" ? "ps-tabs__tab--active" : ""}`}
          role="tab"
          aria-selected={activeTab === "bets"}
          onClick={() => setActiveTab("bets")}
        >
          Bets
        </button>
        <button
          className={`ps-tabs__tab ${activeTab === "history" ? "ps-tabs__tab--active" : ""}`}
          role="tab"
          aria-selected={activeTab === "history"}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </nav>

      {/* Tab content */}
      <div className="ps-widget__content" role="tabpanel">
        {activeTab === "bets" && (
          <>
            {!activeBet && (
              <BetCreate
                balance={balance}
                onCreateBet={handleCreateBet}
                onConsentBet={consentBet}
              />
            )}
            <OpenBets
              bets={openBets}
              loading={betsLoading}
              currentPlayerId={authState.playerId}
              onAccept={handleAcceptBet}
            />
          </>
        )}

        {activeTab === "history" && <BetHistory bets={recentBets} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const root = document.getElementById("playstake-widget-root");
if (root) {
  createRoot(root).render(<WidgetApp />);
}
