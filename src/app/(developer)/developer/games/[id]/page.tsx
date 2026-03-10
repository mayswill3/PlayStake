'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatCents } from '@/lib/utils/format';

interface GameDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  webhookUrl: string;
  minBetAmount: number;
  maxBetAmount: number;
  status: string;
  betCount?: number;
  totalVolume?: number;
}

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [minBet, setMinBet] = useState('');
  const [maxBet, setMaxBet] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/developer/games/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Game not found');
        return r.json();
      })
      .then((data) => {
        setGame(data);
        setName(data.name);
        setDescription(data.description || '');
        setWebhookUrl(data.webhookUrl || '');
        setMinBet((data.minBetAmount / 100).toFixed(2));
        setMaxBet((data.maxBetAmount / 100).toFixed(2));
      })
      .catch(() => setError('Failed to load game.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/developer/games/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          webhookUrl,
          minBetAmount: Math.round(parseFloat(minBet) * 100),
          maxBetAmount: Math.round(parseFloat(maxBet) * 100),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast('error', data.error || 'Failed to update game.');
      } else {
        const updated = await res.json();
        setGame(updated);
        toast('success', 'Game updated.');
      }
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <p className="text-danger-400">{error || 'Game not found.'}</p>
          <Button variant="ghost" onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-surface-400 hover:text-surface-200 transition-colors mb-2"
        >
          &larr; Back to games
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-surface-100">{game.name}</h1>
          <StatusBadge status={game.status || 'ACTIVE'} />
        </div>
        <p className="text-sm text-surface-500 mt-1">Slug: {game.slug}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-surface-400">Total Bets</p>
          <p className="text-xl font-bold text-surface-100">{game.betCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-surface-400">Total Volume</p>
          <p className="text-xl font-bold text-surface-100">{formatCents(game.totalVolume ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-xs text-surface-400">Bet Range</p>
          <p className="text-xl font-bold text-surface-100">
            {formatCents(game.minBetAmount)} - {formatCents(game.maxBetAmount)}
          </p>
        </Card>
      </div>

      {/* Edit form */}
      <Card>
        <CardTitle>Edit Game Settings</CardTitle>
        <form onSubmit={handleSave} className="space-y-4 mt-4">
          <Input
            label="Game Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 text-surface-200 text-sm px-3 py-2 resize-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <Input
            label="Webhook URL"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Bet ($)"
              type="number"
              step="0.01"
              value={minBet}
              onChange={(e) => setMinBet(e.target.value)}
              prefix={<span className="text-sm font-medium">$</span>}
              required
            />
            <Input
              label="Max Bet ($)"
              type="number"
              step="0.01"
              value={maxBet}
              onChange={(e) => setMaxBet(e.target.value)}
              prefix={<span className="text-sm font-medium">$</span>}
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
