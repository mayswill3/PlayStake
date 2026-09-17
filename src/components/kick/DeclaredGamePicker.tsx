'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { notifyKickStatusChanged, useOnKickStatusChanged } from './kick-status';

export interface DeclaredGameOption {
  gameType: string;
  name: string;
  category: string;
  requiresReferee: boolean;
}

export interface DeclaredGameState {
  options: DeclaredGameOption[];
  gameType: string;
  gameName: string | null;
  loading: boolean;
  saving: boolean;
  loadFailed: boolean;
  change: (gameType: string) => Promise<void>;
  /** Reflect a clear made elsewhere (e.g. Go offline) without refetching. */
  clearLocal: () => void;
}

/**
 * The streamer's declared game: the options they can pick and the current
 * choice, saved on change. Loads once, the first time `enabled` is true, so
 * the sidebar only fetches when its Go Live modal is opened.
 */
export function useDeclaredGame(
  enabled: boolean,
  onSaved?: (gameName: string | null) => void,
): DeclaredGameState {
  const { toast } = useToast();
  const [options, setOptions] = useState<DeclaredGameOption[]>([]);
  const [gameType, setGameType] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const requested = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/user/declared-game', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load streaming setup.');
      const data = await response.json();
      setOptions(data.options ?? []);
      setGameType(data.declaredGame?.gameType ?? '');
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || requested.current) return;
    requested.current = true;
    setLoading(true);
    void load();
  }, [enabled, load]);

  // Another control (banner, sidebar, Go offline) changed the game — resync.
  const resync = useCallback(() => {
    if (requested.current) void load();
  }, [load]);
  useOnKickStatusChanged(resync);

  async function change(next: string) {
    const previous = gameType;
    setGameType(next);
    setSaving(true);
    try {
      const response = await fetch('/api/user/declared-game', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType: next || null }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update your game.');
      }
      const data = await response.json();
      setGameType(data.declaredGame?.gameType ?? '');
      onSaved?.(data.declaredGame?.name ?? null);
      notifyKickStatusChanged();
    } catch (error) {
      setGameType(previous);
      toast('error', error instanceof Error ? error.message : 'Failed to update your game.');
    } finally {
      setSaving(false);
    }
  }

  return {
    options,
    gameType,
    gameName: options.find((option) => option.gameType === gameType)?.name ?? null,
    loading,
    saving,
    loadFailed,
    change,
    clearLocal: () => setGameType(''),
  };
}

/** The "Game you're streaming" select with its status/hint line. */
export function DeclaredGamePicker({ state, id }: { state: DeclaredGameState; id: string }) {
  const { options, gameType, gameName, loading, saving, loadFailed } = state;
  const selected = options.find((option) => option.gameType === gameType);
  const grouped = options.reduce<Record<string, DeclaredGameOption[]>>((groups, option) => {
    (groups[option.category] ??= []).push(option);
    return groups;
  }, {});

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark"
      >
        Game you&apos;re streaming
      </label>
      <select
        id={id}
        value={gameType}
        disabled={loading || saving || loadFailed}
        onChange={(event) => void state.change(event.target.value)}
        className="w-full rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper-elevated px-3 py-2.5 text-sm text-ps-text focus:outline-2 focus:outline-offset-2 focus:outline-[var(--ps-lime)] disabled:cursor-wait disabled:opacity-60 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-text-on-dark"
      >
        <option value="">
          {loading ? 'Loading games…' : loadFailed ? 'Unable to load games' : 'None — don’t accept challenges'}
        </option>
        {Object.entries(grouped).map(([category, categoryOptions]) => (
          <optgroup key={category} label={category}>
            {categoryOptions.map((option) => (
              <option key={option.gameType} value={option.gameType}>
                {option.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {loading ? (
        <p className="mt-2 text-xs text-ps-muted dark:text-ps-muted-on-dark" aria-live="polite">
          Loading your streaming setup…
        </p>
      ) : loadFailed ? (
        <p className="mt-2 text-xs text-ps-error" role="alert">
          Couldn&apos;t load your game selection. Refresh the page to try again.
        </p>
      ) : saving ? (
        <p className="mt-2 text-xs text-ps-muted dark:text-ps-muted-on-dark" aria-live="polite">
          Saving your game…
        </p>
      ) : gameType ? (
        <p className="mt-2 text-xs text-ps-muted dark:text-ps-muted-on-dark" aria-live="polite">
          {selected?.requiresReferee
            ? `Live players on ${gameName ?? 'this game'} can challenge you when they select the same game. A referee is required.`
            : `Viewers can challenge you to ${gameName ?? 'this game'}.`}
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ps-warning" aria-live="polite">
          <AlertTriangle size={13} />
          Viewers won&apos;t be able to challenge you until you choose a game.
        </p>
      )}
    </div>
  );
}
