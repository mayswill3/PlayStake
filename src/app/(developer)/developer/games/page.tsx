'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Gamepad2 } from 'lucide-react';
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
    <FadeIn>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-text-primary">Games</h1>
          <Link href="/developer/games/new">
            <Button>Register New Game</Button>
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm font-mono">
            {error}
          </div>
        )}

        {games.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Gamepad2 className="h-10 w-10" />}
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
                <Card className="hover:border-surface-600 transition-colors h-full">
                  <div className="flex items-start gap-3">
                    {game.logoUrl ? (
                      <img
                        src={game.logoUrl}
                        alt={game.name}
                        className="w-12 h-12 rounded-sm object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-sm bg-surface-800 flex items-center justify-center text-text-muted font-display text-lg font-bold">
                        {game.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-display font-semibold text-text-primary truncate">{game.name}</p>
                        <StatusBadge status={game.status || 'ACTIVE'} />
                      </div>
                      <p className="text-xs font-mono text-text-muted mt-0.5">{game.slug}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs font-mono text-text-secondary">
                        <span>Bets: {formatNumber(game.betCount ?? 0)}</span>
                        <span className="tabular-nums">
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
    </FadeIn>
  );
}
