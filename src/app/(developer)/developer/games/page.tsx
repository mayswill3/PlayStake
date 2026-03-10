'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCents, formatNumber } from '@/lib/utils/format';

interface Game {
  id: string;
  name: string;
  slug: string;
  status: string;
  logoUrl: string | null;
  minBetAmount: number;
  maxBetAmount: number;
  betCount?: number;
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/developer/games')
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load games');
        return r.json();
      })
      .then((data) => setGames(data.data || data))
      .catch(() => setError('Failed to load games.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100">Games</h1>
        <Link href="/developer/games/new">
          <Button>Register New Game</Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm">
          {error}
        </div>
      )}

      {games.length === 0 ? (
        <Card>
          <EmptyState
            title="No games registered"
            description="Register your first game to start integrating PlayStake wagering."
            action={
              <Link href="/developer/games/new">
                <Button size="sm">Register Game</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {games.map((game) => (
            <Link key={game.id} href={`/developer/games/${game.id}`}>
              <Card className="hover:border-surface-700 transition-colors h-full">
                <div className="flex items-start gap-3">
                  {game.logoUrl ? (
                    <img
                      src={game.logoUrl}
                      alt={game.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-800 flex items-center justify-center text-surface-500 text-lg font-bold">
                      {game.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-surface-100 truncate">{game.name}</p>
                      <StatusBadge status={game.status || 'ACTIVE'} />
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">{game.slug}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-surface-400">
                      <span>Bets: {formatNumber(game.betCount ?? 0)}</span>
                      <span>
                        {formatCents(game.minBetAmount)} - {formatCents(game.maxBetAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
