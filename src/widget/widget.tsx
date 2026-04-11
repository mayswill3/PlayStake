import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { WidgetConfig, BetOutcome } from "./types";
import { parseWidgetParams, resolveTheme } from "./utils";
import { useWidgetAuth } from "./hooks/useWidgetAuth";
import { useBalance } from "./hooks/useBalance";
import { useBets } from "./hooks/useBets";
import { usePostMessage } from "./hooks/usePostMessage";
import { WidgetAuth } from "./components/WidgetAuth";
import { Balance } from "./components/Balance";
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

function WidgetApp() {
  const params = parseWidgetParams();

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
    activeBet,
    recentBets,
    error: betsError,
    createBet,
    consentBet,
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

  // Note: handleCreateBet / handleAcceptBet were removed along with the
  // BetCreate / OpenBets UI. Bet creation is now driven externally by the
  // matchmaking lobby (via the server-side /api/lobby/respond flow), and
  // the postMessage bridge above still exposes PlayStake.createBet() to any
  // host that wants to drive bet creation from the SDK.
  void sendBetAccepted;
  void sendError;

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

  // Apply theme — resolve "auto" against prefers-color-scheme and subscribe
  // to OS changes so the widget flips live when the user toggles their system
  // theme.
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() =>
    resolveTheme(params.theme)
  );

  useEffect(() => {
    if (params.theme !== "auto") {
      setResolvedTheme(params.theme);
      return;
    }
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setResolvedTheme(mq.matches ? "dark" : "light");
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [params.theme]);

  const themeClass =
    resolvedTheme === "light" ? "ps-widget--light" : "ps-widget--dark";

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
          <img
            src="/logo.png"
            alt="PlayStake"
            className="ps-widget__logo-img"
            width={24}
            height={24}
          />
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

      {/* Content — recent bets only, or an empty prompt when nothing's going on.
          The matchmaking lobby now owns bet creation + opponent discovery, so
          the widget's job is limited to showing the live bet + history. */}
      <div className="ps-widget__content">
        {!activeBet && recentBets.length === 0 && (
          <div className="ps-empty ps-empty--illustrated">
            <div className="ps-empty__icon" aria-hidden="true">🎯</div>
            <p className="ps-empty__title">No active bet</p>
            <p className="ps-empty__subtitle">Matchmake from the lobby to get started</p>
          </div>
        )}
        <BetHistory bets={recentBets} />
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
