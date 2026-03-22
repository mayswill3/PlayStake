'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { PlayerRole } from './types';

interface LobbyPanelProps {
  role: PlayerRole;
  gameCode: string | null;
  onCreateGame: () => Promise<void>;
  onJoinGame: (code: string) => Promise<void>;
  isCreating?: boolean;
  isJoining?: boolean;
}

export function LobbyPanel({
  role,
  gameCode,
  onCreateGame,
  onJoinGame,
  isCreating,
  isJoining,
}: LobbyPanelProps) {
  const [joinCode, setJoinCode] = useState('');

  if (role === 'A') {
    return (
      <Card>
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-text-primary mb-4">
          {gameCode ? 'Waiting for Opponent' : 'Create Game'}
        </h3>

        {!gameCode ? (
          <>
            <p className="text-text-secondary font-mono text-xs mb-4">
              Create a game and place your bet. Share the game code with your opponent.
            </p>
            <Button className="w-full" onClick={onCreateGame} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Game'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-text-secondary font-mono text-xs mb-3">
              Share this code with Player B:
            </p>
            <div className="font-mono text-2xl font-bold text-brand-400 tracking-widest text-center py-3 px-4 bg-surface-900 rounded-sm border-2 border-dashed border-brand-400/30">
              {gameCode}
            </div>
            <p className="text-text-muted font-mono text-xs text-center mt-3">
              Waiting for opponent to join...
            </p>
          </>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-text-primary mb-4">
        Join Game
      </h3>
      <p className="text-text-secondary font-mono text-xs mb-4">
        Enter the game code from Player A:
      </p>
      <input
        className="w-full px-4 py-3 bg-surface-900 border border-white/8 rounded-sm text-text-primary font-mono text-center text-lg tracking-widest uppercase placeholder:text-text-muted focus:outline-none focus:border-brand-400"
        placeholder="GAME CODE"
        maxLength={6}
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
      />
      <Button
        className="w-full mt-3"
        onClick={() => onJoinGame(joinCode)}
        disabled={isJoining || !joinCode}
      >
        {isJoining ? 'Joining...' : 'Join Game'}
      </Button>
    </Card>
  );
}
