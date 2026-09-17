'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, ExternalLink, Gamepad2, Radio, X } from 'lucide-react';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { DeclaredGamePicker, type DeclaredGameState } from './DeclaredGamePicker';

export interface SuggestedGame {
  gameType: string;
  name: string;
  /** Whose game this is, e.g. the streamer being viewed. */
  streamerName: string;
}

/**
 * Go Live without leaving the page: pick the game you're streaming, then start
 * the broadcast on Kick. Opened from the sidebar Kick card and the Go Live banner.
 *
 * Uses a native <dialog> (top layer, so the sidebar's mobile transform can't
 * clip it; Esc and focus handling come for free).
 */
export function GoLiveModal({
  open,
  onClose,
  declared,
  isLive,
  suggestedGame,
}: {
  open: boolean;
  onClose: () => void;
  declared: DeclaredGameState;
  isLive: boolean;
  /** One-click pick of the game you need to match (e.g. to challenge a streamer). */
  suggestedGame?: SuggestedGame | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      aria-labelledby="go-live-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-0 text-ps-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-text-on-dark"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ps-radius-md)] bg-ps-lime/10 text-ps-lime">
            <Radio size={18} strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="go-live-title" className="font-display text-lg font-semibold">
              Go live
            </h2>
            <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">
              Two steps and viewers can start challenging you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[var(--ps-radius-md)] p-1.5 text-ps-muted transition-colors hover:bg-ps-paper hover:text-ps-text dark:text-ps-muted-on-dark dark:hover:bg-ps-ink-3 dark:hover:text-ps-text-on-dark"
          >
            <X size={18} />
          </button>
        </div>

        <ol className="mt-5 space-y-5">
          <li className="flex gap-3">
            <StepNumber n={1} done={Boolean(declared.gameType)} />
            <div className="min-w-0 flex-1">
              {suggestedGame && declared.gameType !== suggestedGame.gameType && (
                <button
                  type="button"
                  onClick={() => void declared.change(suggestedGame.gameType)}
                  disabled={declared.loading || declared.saving}
                  className="mb-3 flex w-full items-center gap-2 rounded-[var(--ps-radius-md)] border border-ps-lime/50 bg-ps-lime/10 px-3 py-2.5 text-left text-sm transition-colors hover:bg-ps-lime/20 disabled:opacity-60"
                >
                  <Gamepad2 size={16} className="shrink-0 text-ps-lime" aria-hidden="true" />
                  <span className="min-w-0">
                    Stream <span className="font-semibold">{suggestedGame.name}</span>
                    <span className="text-ps-muted dark:text-ps-muted-on-dark"> — same as {suggestedGame.streamerName}</span>
                  </span>
                </button>
              )}
              <DeclaredGamePicker state={declared} id="declared-game-modal" />
            </div>
          </li>
          <li className="flex gap-3">
            <StepNumber n={2} done={isLive} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
                Start your stream on Kick
              </p>
              {isLive ? (
                <p className="mt-1.5 text-sm text-ps-text dark:text-ps-text-on-dark">
                  You&apos;re live on Kick — you&apos;re all set.
                </p>
              ) : (
                <>
                  <p className="mt-1.5 text-sm text-ps-muted dark:text-ps-muted-on-dark">
                    Start broadcasting from your streaming software. PlayStake shows you as live automatically.
                  </p>
                  <a
                    href="https://dashboard.kick.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block"
                  >
                    <PSButton variant="primary" size="md" fullWidth icon={<ExternalLink size={16} />}>
                      Open Kick
                    </PSButton>
                  </a>
                </>
              )}
            </div>
          </li>
        </ol>

        <div className="mt-6 flex justify-end">
          <PSButton variant="ghost" size="sm" onClick={onClose}>
            Done
          </PSButton>
        </div>
      </div>
    </dialog>
  );
}

function StepNumber({ n, done }: { n: number; done: boolean }) {
  return done ? (
    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-ps-lime" aria-label={`Step ${n} done`} />
  ) : (
    <span
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--ps-border-light)] text-xs font-bold text-ps-muted dark:border-[var(--ps-border-dark)] dark:text-ps-muted-on-dark"
      aria-label={`Step ${n}`}
    >
      {n}
    </span>
  );
}
