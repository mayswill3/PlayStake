'use client';

import { useState } from 'react';
import { ExternalLink, Gamepad2, Power, Radio } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { KickPlayer } from '@/components/ui/playstake/KickPlayer';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { DeclaredGamePicker, useDeclaredGame } from './DeclaredGamePicker';
import { GoLiveModal } from './GoLiveModal';
import {
  GO_OFFLINE_TOAST,
  goOfflineOnPlayStake,
  notifyKickStatusChanged,
  useKickStatus,
} from './kick-status';

interface KickConnectionCardProps {
  variant?: 'sidebar' | 'featured';
}

export function KickConnectionCard({ variant = 'sidebar' }: KickConnectionCardProps) {
  const featured = variant === 'featured';
  const { toast } = useToast();
  const { status, setStatus, loading } = useKickStatus();
  const [disconnecting, setDisconnecting] = useState(false);
  const [goingOffline, setGoingOffline] = useState(false);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  // The featured card shows the picker inline; the sidebar loads it only once
  // its Go Live modal is opened.
  const declared = useDeclaredGame(featured || goLiveOpen, (gameName) =>
    setStatus((current) => current && { ...current, declaredGameName: gameName }),
  );

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch('/api/user/kick', { method: 'DELETE' });
      if (!response.ok) {
        toast('error', 'Failed to disconnect Kick.');
        return;
      }

      setStatus({ connected: false });
      notifyKickStatusChanged();
      toast('success', 'Kick channel disconnected.');
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setDisconnecting(false);
    }
  }

  // Going offline on PlayStake clears the declared game, which stops new
  // challenges. PlayStake can't end the Kick broadcast itself.
  async function handleGoOffline() {
    setGoingOffline(true);
    try {
      await goOfflineOnPlayStake();
      declared.clearLocal();
      setStatus((current) => current && { ...current, declaredGameName: null });
      toast('success', GO_OFFLINE_TOAST);
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
  // Once the picker has loaded, it's the freshest source of the game name.
  const currentGameName = declared.options.length > 0 ? declared.gameName : status?.declaredGameName ?? null;

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
          <DeclaredGamePicker state={declared} id="declared-game" />
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
                // picker right above; the sidebar opens it in the Go Live modal.
                !featured && (
                  <PSButton
                    variant="primary"
                    size="sm"
                    fullWidth
                    icon={<Gamepad2 size={14} />}
                    className="min-h-9 text-xs"
                    onClick={() => setGoLiveOpen(true)}
                  >
                    Choose your game
                  </PSButton>
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
                // The sidebar card has no room for the picker — Go Live opens it
                // in a modal alongside the "start your stream" step.
                <PSButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  icon={<Radio size={14} />}
                  className="min-h-9 text-xs"
                  onClick={() => setGoLiveOpen(true)}
                >
                  Go Live
                </PSButton>
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

      {!featured && connected && (
        <GoLiveModal open={goLiveOpen} onClose={() => setGoLiveOpen(false)} declared={declared} isLive={isLive} />
      )}
    </section>
  );
}
