'use client';

import { useState } from 'react';
import { AlertTriangle, Gamepad2, Power, Radio } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { useDeclaredGame } from './DeclaredGamePicker';
import { GoLiveModal, type SuggestedGame } from './GoLiveModal';
import { GO_OFFLINE_TOAST, goOfflineOnPlayStake, useKickStatus } from './kick-status';

/**
 * The prominent Go Live entry point (dashboard, stream pages) — the sidebar
 * card is easy to miss. Reflects the user's state: connect Kick → go live →
 * pick a game → live (change game / go offline). On a streamer's page, pass
 * `suggestedGame` so matching their game (needed to challenge them) is one click.
 */
export function GoLiveBanner({ suggestedGame }: { suggestedGame?: SuggestedGame | null }) {
  const { toast } = useToast();
  const { status, setStatus, loading } = useKickStatus();
  const [modalOpen, setModalOpen] = useState(false);
  const [goingOffline, setGoingOffline] = useState(false);
  const declared = useDeclaredGame(modalOpen, (gameName) =>
    setStatus((current) => current && { ...current, declaredGameName: gameName }),
  );

  if (loading || !status) return null;

  if (!status.connected) {
    return (
      <section
        aria-label="Go live"
        className="flex flex-col gap-3 rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ps-radius-md)] bg-ps-lime/10 text-ps-lime">
            <Radio size={18} strokeWidth={2.5} />
          </span>
          <div>
            <p className="font-display font-semibold text-ps-text dark:text-ps-text-on-dark">Stream on PlayStake</p>
            <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">
              Connect your Kick channel to go live and take challenges.
            </p>
          </div>
        </div>
        <a href="/api/auth/kick" className="shrink-0">
          <PSButton variant="primary" size="sm" icon={<Radio size={14} />}>
            Connect Kick
          </PSButton>
        </a>
      </section>
    );
  }

  const isLive = Boolean(status.isLive);
  const gameName = declared.options.length > 0 ? declared.gameName : status.declaredGameName ?? null;
  const mismatch = Boolean(suggestedGame && gameName && gameName !== suggestedGame.name);

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

  let eyebrow: React.ReactNode;
  let title: string;
  let detail: React.ReactNode;
  let actions: React.ReactNode;

  if (isLive && gameName) {
    eyebrow = (
      <span className="inline-flex items-center gap-1.5 text-ps-error">
        <span className="h-2 w-2 rounded-full bg-ps-error animate-pulse" aria-hidden="true" />
        You&apos;re live
      </span>
    );
    title = `Streaming ${gameName}`;
    detail = mismatch ? (
      <span className="inline-flex items-center gap-1.5 text-ps-warning">
        <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
        To challenge {suggestedGame!.streamerName}, switch to {suggestedGame!.name}.
      </span>
    ) : (
      'Viewers and live players on your game can challenge you.'
    );
    actions = (
      <>
        <PSButton
          variant={mismatch ? 'primary' : 'secondary'}
          size="md"
          icon={<Gamepad2 size={16} />}
          onClick={() => setModalOpen(true)}
        >
          {mismatch ? 'Switch game' : 'Change game'}
        </PSButton>
        <PSButton
          variant="ghost"
          size="md"
          loading={goingOffline}
          icon={<Power size={16} />}
          onClick={handleGoOffline}
          className="text-ps-text-on-dark hover:bg-white/10"
        >
          Go offline
        </PSButton>
      </>
    );
  } else if (isLive) {
    eyebrow = <span className="text-ps-warning">Live on Kick</span>;
    title = suggestedGame ? `Pick ${suggestedGame.name} to challenge ${suggestedGame.streamerName}` : 'Choose your game to take challenges';
    detail = 'You’re streaming, but viewers can’t challenge you until you pick a game.';
    actions = (
      <PSButton variant="primary" size="md" icon={<Gamepad2 size={16} />} onClick={() => setModalOpen(true)}>
        Choose your game
      </PSButton>
    );
  } else {
    eyebrow = <span className="text-ps-lime">Go live</span>;
    title = suggestedGame
      ? `Want to challenge ${suggestedGame.streamerName}? Go live on ${suggestedGame.name}`
      : 'Go live and take challenges';
    detail = gameName ? (
      <span className="inline-flex items-center gap-1.5">
        <Gamepad2 size={14} className="shrink-0 text-ps-lime" aria-hidden="true" />
        Ready to stream {gameName} — start your broadcast on Kick.
      </span>
    ) : suggestedGame ? (
      'Refereed matches need both players live on Kick with the same game.'
    ) : (
      'Pick your game and start streaming on Kick — viewers can challenge you straight away.'
    );
    actions = (
      <PSButton variant="primary" size="md" icon={<Radio size={16} />} onClick={() => setModalOpen(true)}>
        Go Live
      </PSButton>
    );
  }

  return (
    <section
      aria-label="Go live"
      className="relative overflow-hidden rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-dark)] bg-ps-ink p-5 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-ps-lime/15 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--ps-radius-md)] bg-ps-lime/15 text-ps-lime">
            {isLive && (
              <span className="absolute inset-0 rounded-[var(--ps-radius-md)] bg-ps-error/20 animate-ping motion-reduce:animate-none" aria-hidden="true" />
            )}
            <Radio size={22} strokeWidth={2.5} className="relative" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest">{eyebrow}</p>
            <p className="mt-1 font-display text-xl font-semibold text-ps-text-on-dark sm:text-2xl">{title}</p>
            <p className="mt-1 text-sm text-ps-muted-on-dark">{detail}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      </div>

      <GoLiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        declared={declared}
        isLive={isLive}
        suggestedGame={suggestedGame}
      />
    </section>
  );
}
