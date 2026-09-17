'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Gamepad2, Power, Radio } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { KickPlayer } from '@/components/ui/playstake/KickPlayer';
import { PSButton } from '@/components/ui/playstake/PSButton';

interface KickStatus {
  connected: boolean;
  channelSlug?: string | null;
  displayName?: string | null;
  isLive?: boolean;
  /** Game declared on PlayStake — what viewers can challenge them to. */
  declaredGameName?: string | null;
}

/** Re-check live status so the card flips to Live without a reload. */
const STATUS_POLL_MS = 30_000;

interface KickConnectionCardProps {
  variant?: 'sidebar' | 'featured';
}

interface DeclaredGameOption {
  gameType: string;
  name: string;
  category: string;
  requiresReferee: boolean;
}

export function KickConnectionCard({ variant = 'sidebar' }: KickConnectionCardProps) {
  const featured = variant === 'featured';
  const { toast } = useToast();
  const [status, setStatus] = useState<KickStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gameOptions, setGameOptions] = useState<DeclaredGameOption[]>([]);
  const [declaredGameType, setDeclaredGameType] = useState('');
  const [declaredLoading, setDeclaredLoading] = useState(false);
  const [declaredSaving, setDeclaredSaving] = useState(false);
  const [declaredLoadFailed, setDeclaredLoadFailed] = useState(false);
  const [goingOffline, setGoingOffline] = useState(false);

  useEffect(() => {
    fetch('/api/user/kick')
      .then((response) => (response.ok ? response.json() : { connected: false }))
      .then((data) => setStatus(data))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));

    const timer = window.setInterval(() => {
      fetch('/api/user/kick')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => data && setStatus(data))
        .catch(() => {});
    }, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!featured) return;

    let active = true;
    setDeclaredLoading(true);
    setDeclaredLoadFailed(false);
    fetch('/api/user/declared-game')
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load streaming setup.');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setGameOptions(data.options ?? []);
        setDeclaredGameType(data.declaredGame?.gameType ?? '');
      })
      .catch(() => {
        if (active) setDeclaredLoadFailed(true);
      })
      .finally(() => {
        if (active) setDeclaredLoading(false);
      });

    return () => {
      active = false;
    };
  }, [featured]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch('/api/user/kick', { method: 'DELETE' });
      if (!response.ok) {
        toast('error', 'Failed to disconnect Kick.');
        return;
      }

      setStatus({ connected: false });
      toast('success', 'Kick channel disconnected.');
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleDeclaredGameChange(gameType: string) {
    const previousGameType = declaredGameType;
    setDeclaredGameType(gameType);
    setDeclaredSaving(true);

    try {
      const response = await fetch('/api/user/declared-game', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType: gameType || null }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update your game.');
      }

      const data = await response.json();
      setDeclaredGameType(data.declaredGame?.gameType ?? '');
      setStatus((current) => current && { ...current, declaredGameName: data.declaredGame?.name ?? null });
    } catch (error) {
      setDeclaredGameType(previousGameType);
      toast('error', error instanceof Error ? error.message : 'Failed to update your game.');
    } finally {
      setDeclaredSaving(false);
    }
  }

  // Going offline on PlayStake clears the declared game, which stops new
  // challenges. PlayStake can't end the Kick broadcast itself.
  async function handleGoOffline() {
    setGoingOffline(true);
    try {
      const response = await fetch('/api/user/declared-game', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType: null }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not go offline.');
      }
      setDeclaredGameType('');
      setStatus((current) => current && { ...current, declaredGameName: null });
      toast('success', 'You’re offline on PlayStake — challenges are paused. End the broadcast on Kick to stop streaming.');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Could not go offline.');
    } finally {
      setGoingOffline(false);
    }
  }

  const connected = status?.connected;
  const isLive = Boolean(status?.isLive);
  const slug = status?.channelSlug;
  const channelName = slug ?? status?.displayName ?? 'your channel';
  const declaredGameName = gameOptions.find(
    (option) => option.gameType === declaredGameType,
  )?.name;
  const selectedGame = gameOptions.find(
    (option) => option.gameType === declaredGameType,
  );
  // The featured card's dropdown is the freshest source once its options load.
  const currentGameName =
    featured && gameOptions.length > 0 ? declaredGameName ?? null : status?.declaredGameName ?? null;
  const groupedGameOptions = gameOptions.reduce<Record<string, DeclaredGameOption[]>>(
    (groups, option) => {
      (groups[option.category] ??= []).push(option);
      return groups;
    },
    {},
  );

  return (
    <section
      id={featured ? 'go-live' : undefined}
      aria-label="Kick connection"
      className={`shrink-0 scroll-mt-20 rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 ${
        featured ? 'p-5 sm:p-6' : 'mx-3 mb-3 p-3'
      }`}
    >
      <div className={`flex items-center ${featured ? 'gap-3' : 'gap-2'}`}>
        <span
          className={`flex shrink-0 items-center justify-center rounded-[var(--ps-radius-md)] bg-ps-lime/10 text-ps-lime ${
            featured ? 'h-11 w-11' : 'h-8 w-8'
          }`}
        >
          <Radio size={featured ? 20 : 15} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2
              className={`font-display font-semibold text-ps-text dark:text-ps-text-on-dark ${
                featured ? 'text-lg' : 'text-sm'
              }`}
            >
              Kick
            </h2>
            {!loading && connected && (
              <span
                className={`inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider ${
                  featured ? 'text-xs' : 'text-[10px]'
                } ${
                  isLive ? 'text-ps-error' : 'text-ps-lime'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isLive ? 'bg-ps-error animate-pulse' : 'bg-ps-lime'
                  }`}
                />
                {isLive ? 'Live' : 'Connected'}
              </span>
            )}
          </div>
          <p
            className={`truncate text-ps-muted dark:text-ps-muted-on-dark ${
              featured ? 'text-sm' : 'text-[11px]'
            }`}
          >
            {loading
              ? 'Checking connection…'
              : connected
                ? channelName
                : 'Connect your channel'}
          </p>
        </div>
      </div>

      {!loading && connected && isLive && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-[var(--ps-radius-md)] px-2.5 py-2 ${
            currentGameName ? 'bg-ps-lime/10' : 'bg-ps-warning/10'
          }`}
        >
          <Gamepad2
            size={featured ? 16 : 14}
            className={`shrink-0 ${currentGameName ? 'text-ps-lime' : 'text-ps-warning'}`}
            aria-hidden="true"
          />
          <p className={`min-w-0 ${featured ? 'truncate text-sm' : 'text-xs leading-snug'}`}>
            {currentGameName ? (
              <>
                <span className="text-ps-muted dark:text-ps-muted-on-dark">Streaming </span>
                <span className="font-semibold text-ps-text dark:text-ps-text-on-dark">{currentGameName}</span>
              </>
            ) : (
              <span className="font-medium text-ps-warning">
                {featured ? 'Live on Kick — no game selected' : 'No game selected'}
              </span>
            )}
          </p>
        </div>
      )}

      {!loading && connected && slug && (
        <div className="mt-3">
          <KickPlayer slug={slug} />
        </div>
      )}

      {!loading && featured && connected && (
        <div className="mt-4 rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper p-4 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-3">
          <label
            htmlFor="declared-game"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark"
          >
            Game you&apos;re streaming
          </label>
          <select
            id="declared-game"
            value={declaredGameType}
            disabled={declaredLoading || declaredSaving || declaredLoadFailed}
            onChange={(event) => void handleDeclaredGameChange(event.target.value)}
            className="w-full rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper-elevated px-3 py-2.5 text-sm text-ps-text focus:outline-2 focus:outline-offset-2 focus:outline-[var(--ps-lime)] disabled:cursor-wait disabled:opacity-60 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-text-on-dark"
          >
            <option value="">
              {declaredLoading
                ? 'Loading games…'
                : declaredLoadFailed
                  ? 'Unable to load games'
                  : 'None — don’t accept challenges'}
            </option>
            {Object.entries(groupedGameOptions).map(([category, options]) => (
              <optgroup key={category} label={category}>
                {(options ?? []).map((option) => (
                  <option key={option.gameType} value={option.gameType}>
                    {option.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {declaredLoading ? (
            <p className="mt-2 text-xs text-ps-muted dark:text-ps-muted-on-dark" aria-live="polite">
              Loading your streaming setup…
            </p>
          ) : declaredLoadFailed ? (
            <p className="mt-2 text-xs text-ps-error" role="alert">
              Couldn&apos;t load your game selection. Refresh the page to try again.
            </p>
          ) : declaredSaving ? (
            <p className="mt-2 text-xs text-ps-muted dark:text-ps-muted-on-dark" aria-live="polite">
              Saving your game…
            </p>
          ) : declaredGameType ? (
            <p className="mt-2 text-xs text-ps-muted dark:text-ps-muted-on-dark" aria-live="polite">
              {selectedGame?.requiresReferee
                ? `Live players on ${declaredGameName ?? 'this game'} can challenge you when they select the same game. A referee is required.`
                : `Viewers can challenge you to ${declaredGameName ?? 'this game'}.`}
            </p>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ps-warning" aria-live="polite">
              <AlertTriangle size={13} />
              Viewers won&apos;t be able to challenge you until you choose a game.
            </p>
          )}
        </div>
      )}

      {!loading && (
        <div className={featured ? 'mt-4' : 'mt-3'}>
          {connected ? (
            <div className="space-y-1">
              {isLive && currentGameName ? (
                // Live with a game declared: no Go Live — offer to go offline on PlayStake.
                <PSButton
                  variant="secondary"
                  size={featured ? 'md' : 'sm'}
                  fullWidth
                  loading={goingOffline}
                  onClick={handleGoOffline}
                  icon={<Power size={featured ? 16 : 14} />}
                  className={featured ? '' : 'min-h-9 text-xs'}
                >
                  Go offline
                </PSButton>
              ) : isLive ? (
                // Live on Kick but not challengeable yet. The featured card has the
                // picker right above; the sidebar sends them to it.
                !featured && (
                  <Link href="/play#go-live" className="block">
                    <PSButton
                      variant="primary"
                      size="sm"
                      fullWidth
                      icon={<Gamepad2 size={14} />}
                      className="min-h-9 text-xs"
                    >
                      Choose your game
                    </PSButton>
                  </Link>
                )
              ) : featured ? (
                <a
                  href="https://dashboard.kick.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <PSButton
                    variant="primary"
                    size="md"
                    fullWidth
                    icon={<ExternalLink size={16} />}
                  >
                    Go Live
                  </PSButton>
                </a>
              ) : (
                // The sidebar card has no game picker — send the streamer to the
                // featured card on /play to declare their game before going live.
                <Link href="/play#go-live" className="block">
                  <PSButton
                    variant="primary"
                    size="sm"
                    fullWidth
                    icon={<Radio size={14} />}
                    className="min-h-9 text-xs"
                  >
                    Go Live
                  </PSButton>
                </Link>
              )}
              <PSButton
                variant="ghost"
                size={featured ? 'md' : 'sm'}
                fullWidth
                loading={disconnecting}
                onClick={handleDisconnect}
                className={featured ? '' : 'min-h-8 text-xs'}
              >
                Disconnect
              </PSButton>
            </div>
          ) : (
            <a href="/api/auth/kick" className="block">
              <PSButton
                variant="primary"
                size={featured ? 'md' : 'sm'}
                fullWidth
                icon={<Radio size={featured ? 16 : 14} />}
                className={featured ? '' : 'min-h-9 text-xs'}
              >
                Connect Kick
              </PSButton>
            </a>
          )}
        </div>
      )}
    </section>
  );
}
