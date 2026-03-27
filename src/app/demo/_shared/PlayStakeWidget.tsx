'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// Declare the global PlayStake SDK type
declare global {
  interface Window {
    PlayStake?: {
      init: (config: {
        widgetToken: string;
        gameId: string;
        containerId: string;
        theme: string;
        onBetCreated?: (bet: { betId: string; amount: number }) => void;
        onBetAccepted?: (bet: { betId: string }) => void;
        onBetSettled?: (bet: { outcome: string }) => void;
        onError?: (err: { message: string }) => void;
      }) => {
        open: () => void;
        close: () => void;
        destroy: () => void;
        isOpen: () => boolean;
        refreshBalance: () => void;
      };
      _setOrigin: (origin: string) => void;
    };
  }
}

export interface PlayStakeWidgetHandle {
  refreshBalance: () => void;
}

interface PlayStakeWidgetProps {
  widgetToken: string | null;
  gameId: string | null;
  onBetCreated?: (bet: { betId: string; amount: number }) => void;
  onBetAccepted?: (bet: { betId: string }) => void;
  onBetSettled?: (bet: { outcome: string }) => void;
  onError?: (err: { message: string }) => void;
}

export const PlayStakeWidget = forwardRef<PlayStakeWidgetHandle, PlayStakeWidgetProps>(function PlayStakeWidget({
  widgetToken,
  gameId,
  onBetCreated,
  onBetAccepted,
  onBetSettled,
  onError,
}, ref) {
  const widgetRef = useRef<ReturnType<NonNullable<typeof window.PlayStake>['init']> | null>(null);

  useImperativeHandle(ref, () => ({
    refreshBalance: () => widgetRef.current?.refreshBalance(),
  }));
  const containerId = 'playstake-widget-container';

  useEffect(() => {
    if (!widgetToken || !gameId) return;

    const token = widgetToken;
    const game = gameId;

    // Load SDK if not already loaded
    function initWidget() {
      if (!window.PlayStake) return;

      window.PlayStake._setOrigin(window.location.origin);

      widgetRef.current = window.PlayStake.init({
        widgetToken: token,
        gameId: game,
        containerId,
        theme: 'dark',
        onBetCreated,
        onBetAccepted,
        onBetSettled,
        onError,
      });

      widgetRef.current.open();
    }

    if (window.PlayStake) {
      initWidget();
    } else {
      const script = document.createElement('script');
      script.src = '/widget/sdk.js';
      script.onload = initWidget;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetRef.current) {
        widgetRef.current.destroy();
        widgetRef.current = null;
      }
    };
    // Only re-init when token/gameId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetToken, gameId]);

  if (!widgetToken) {
    return (
      <div className="rounded-sm bg-surface-900 overflow-hidden min-h-[480px] flex items-center justify-center">
        <p className="text-text-muted font-mono text-sm">
          Select a player role to begin
        </p>
      </div>
    );
  }

  return (
    <div
      id={containerId}
      className="rounded-sm bg-surface-900 overflow-hidden min-h-[600px] [&>div]:!relative [&>div]:!w-full [&>div]:!h-full [&>div]:!min-h-[600px] [&>div]:!max-h-none [&>div]:!rounded-none [&>div]:!shadow-none [&>div]:!border-none [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!min-h-[600px] [&_iframe]:!border-none"
    />
  );
});
