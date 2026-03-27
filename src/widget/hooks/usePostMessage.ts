import { useEffect, useCallback, useRef } from "react";
import type { PostMessageEvent, BetData } from "../types";

interface UsePostMessageOptions {
  instanceId: string;
  /** Called when the host game sends a CREATE_BET command */
  onCreateBet?: (payload: { amount: number; opponentId?: string; metadata?: Record<string, unknown> }) => void;
  /** Called when the host game sends an OPEN command */
  onOpen?: () => void;
  /** Called when the host game sends a CLOSE command */
  onClose?: () => void;
  /** Called when the host game sends a REFRESH_BALANCE command */
  onRefreshBalance?: () => void;
}

/**
 * Handles bidirectional postMessage communication with the host game SDK.
 *
 * Inbound: Receives CREATE_BET, OPEN, CLOSE from the SDK.
 * Outbound: Sends WIDGET_READY, BET_CREATED, BET_ACCEPTED, BET_SETTLED, ERROR to the SDK.
 *
 * Performs strict origin validation — only accepts messages whose `source`
 * field is `"playstake-sdk"`. The SDK sets the correct origin via the
 * iframe src domain.
 */
export function usePostMessage({
  instanceId,
  onCreateBet,
  onOpen,
  onClose,
  onRefreshBalance,
}: UsePostMessageOptions) {
  const parentOriginRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onCreateBet, onOpen, onClose, onRefreshBalance });
  callbacksRef.current = { onCreateBet, onOpen, onClose, onRefreshBalance };

  // Send message to parent
  const sendToParent = useCallback(
    (type: string, payload?: unknown) => {
      if (!window.parent || window.parent === window) return;

      const msg: PostMessageEvent = {
        source: "playstake-widget",
        instanceId,
        type,
        payload,
      };

      // Use "*" for initial WIDGET_READY since we don't know the parent origin yet.
      // After the first inbound message, we lock to that origin.
      const target = parentOriginRef.current || "*";
      window.parent.postMessage(msg, target);
    },
    [instanceId]
  );

  // Listen for messages from parent
  useEffect(() => {
    function handler(event: MessageEvent) {
      const data = event.data as PostMessageEvent | null;

      // Validate message structure
      if (!data || data.source !== "playstake-sdk") return;

      // Lock to the first valid parent origin
      if (!parentOriginRef.current) {
        parentOriginRef.current = event.origin;
      }

      // After locking, reject messages from other origins
      if (event.origin !== parentOriginRef.current) return;

      // Optional instance check
      if (data.instanceId && data.instanceId !== instanceId) return;

      switch (data.type) {
        case "CREATE_BET":
          if (callbacksRef.current.onCreateBet && data.payload) {
            callbacksRef.current.onCreateBet(
              data.payload as {
                amount: number;
                opponentId?: string;
                metadata?: Record<string, unknown>;
              }
            );
          }
          break;

        case "OPEN":
          if (callbacksRef.current.onOpen) callbacksRef.current.onOpen();
          break;

        case "CLOSE":
          if (callbacksRef.current.onClose) callbacksRef.current.onClose();
          break;

        case "REFRESH_BALANCE":
          if (callbacksRef.current.onRefreshBalance) callbacksRef.current.onRefreshBalance();
          break;
      }
    }

    window.addEventListener("message", handler, false);
    return () => window.removeEventListener("message", handler, false);
  }, [instanceId]);

  // Send WIDGET_READY on mount
  useEffect(() => {
    sendToParent("WIDGET_READY");
  }, [sendToParent]);

  // Helper senders for specific events
  const sendBetCreated = useCallback(
    (bet: BetData) => sendToParent("BET_CREATED", bet),
    [sendToParent]
  );

  const sendBetAccepted = useCallback(
    (bet: BetData) => sendToParent("BET_ACCEPTED", bet),
    [sendToParent]
  );

  const sendBetSettled = useCallback(
    (bet: BetData) => sendToParent("BET_SETTLED", bet),
    [sendToParent]
  );

  const sendError = useCallback(
    (error: { code: string; message: string }) =>
      sendToParent("ERROR", error),
    [sendToParent]
  );

  return {
    sendToParent,
    sendBetCreated,
    sendBetAccepted,
    sendBetSettled,
    sendError,
  };
}
