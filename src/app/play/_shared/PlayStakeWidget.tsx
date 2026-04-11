'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useId } from 'react';

// ---------------------------------------------------------------------------
// useIsDarkTheme — reactively tracks the main site's theme by watching the
// `dark` class on <html>. Theme toggle in src/components/ui/theme-toggle.tsx
// flips that class + writes localStorage; this hook mirrors the class into
// React state so the widget iframe can be re-initialised with the correct
// theme URL parameter whenever the user toggles.
// ---------------------------------------------------------------------------
function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return true;
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    // Read the current value once on mount in case it was set after hydration.
    setIsDark(html.classList.contains('dark'));

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains('dark'));
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

// Module-level promise for loading the SDK script exactly once across all
// PlayStakeWidget instances on the page. Without this, StrictMode's double
// effect invocation (and multiple widget mounts) each append their own
// <script> tag and each register their own onload callback, producing orphan
// iframes when those closures fire after the component has already cleaned up.
let sdkLoadPromise: Promise<void> | null = null;
function loadSdkOnce(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.PlayStake) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-playstake-sdk]');
    if (existing) {
      if (window.PlayStake) return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('SDK load failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = '/widget/sdk.js';
    script.dataset.playstakeSdk = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('SDK load failed'));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

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

  // Unique container id per instance so concurrent widgets can't step on
  // each other's DOM slot. useId is stable across renders and unique per
  // component instance.
  const reactId = useId();
  const containerId = `playstake-widget-container-${reactId.replace(/[:]/g, '')}`;

  // Reactive theme — the widget iframe URL bakes in a `theme` query param,
  // so whenever the main site toggles light/dark we destroy and re-init the
  // SDK with the new value.
  const isDark = useIsDarkTheme();

  // Keep the latest callbacks in refs so we don't re-init the SDK every time
  // the parent re-renders (callbacks are recreated on every render).
  const onBetCreatedRef = useRef(onBetCreated);
  const onBetAcceptedRef = useRef(onBetAccepted);
  const onBetSettledRef = useRef(onBetSettled);
  const onErrorRef = useRef(onError);
  onBetCreatedRef.current = onBetCreated;
  onBetAcceptedRef.current = onBetAccepted;
  onBetSettledRef.current = onBetSettled;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!widgetToken || !gameId) return;

    const token = widgetToken;
    const game = gameId;
    let cancelled = false;

    const initWidget = () => {
      if (cancelled) return;
      if (!window.PlayStake) return;

      window.PlayStake._setOrigin(window.location.origin);

      widgetRef.current = window.PlayStake.init({
        widgetToken: token,
        gameId: game,
        containerId,
        theme: isDark ? 'dark' : 'light',
        onBetCreated: (bet) => onBetCreatedRef.current?.(bet),
        onBetAccepted: (bet) => onBetAcceptedRef.current?.(bet),
        onBetSettled: (bet) => onBetSettledRef.current?.(bet),
        onError: (err) => onErrorRef.current?.(err),
      });

      widgetRef.current.open();
    };

    loadSdkOnce()
      .then(() => initWidget())
      .catch((err) => onErrorRef.current?.({ message: err?.message ?? 'SDK load failed' }));

    return () => {
      cancelled = true;
      if (widgetRef.current) {
        widgetRef.current.destroy();
        widgetRef.current = null;
      }
    };
    // Only re-init when token/gameId, containerId, or the theme changes.
  }, [widgetToken, gameId, containerId, isDark]);

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
