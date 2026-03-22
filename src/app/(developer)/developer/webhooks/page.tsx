'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { FadeIn } from '@/components/ui/FadeIn';
import { Webhook } from 'lucide-react';

interface Game {
  id: string;
  name: string;
  slug: string;
  webhookUrl: string | null;
}

export default function WebhooksPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/developer/games')
      .then(async (r) => {
        if (!r.ok) return [];
        const data = await r.json();
        return data.data || data;
      })
      .then(setGames)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
    );
  }

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Webhooks</h1>
          <p className="text-text-secondary font-mono text-sm mt-1">
            Webhook endpoints are configured per-game. Select a game to manage its webhook settings.
          </p>
        </div>

        {games.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Webhook className="h-10 w-10" />}
              title="No games registered"
              description="Register a game first, then configure its webhook endpoints."
              action={<Link href="/developer/games/new"><Button size="sm">Register Game</Button></Link>}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <Link key={game.id} href={`/developer/games/${game.id}`}>
                <Card className="hover:border-surface-600 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-display font-semibold text-text-primary">{game.name}</p>
                      <p className="text-xs font-mono text-text-muted mt-0.5">{game.slug}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {game.webhookUrl ? (
                        <>
                          <code className="text-xs text-text-muted font-mono bg-surface-800 px-2 py-1 rounded-sm max-w-[200px] truncate">
                            {game.webhookUrl}
                          </code>
                          <Badge variant="success">Configured</Badge>
                        </>
                      ) : (
                        <Badge variant="warning">Not configured</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <Card>
          <CardTitle>Webhook Events</CardTitle>
          <CardDescription>PlayStake sends the following webhook events to your endpoints.</CardDescription>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { event: 'BET_CREATED', description: 'A new bet has been proposed' },
              { event: 'BET_MATCHED', description: 'Both players have accepted and bet is live' },
              { event: 'BET_SETTLED', description: 'Bet has been settled and payouts processed' },
              { event: 'BET_CANCELLED', description: 'Bet has been cancelled or expired' },
              { event: 'BET_DISPUTED', description: 'A dispute has been filed' },
            ].map((item) => (
              <div key={item.event} className="p-3 rounded-sm bg-surface-800">
                <code className="text-xs text-brand-400 font-mono">{item.event}</code>
                <p className="text-xs font-mono text-text-secondary mt-1">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </FadeIn>
  );
}
