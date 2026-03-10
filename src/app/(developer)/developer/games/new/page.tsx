'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function NewGamePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [minBet, setMinBet] = useState('1.00');
  const [maxBet, setMaxBet] = useState('500.00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugManual, setSlugManual] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManual) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/developer/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: slug || slugify(name),
          description,
          logoUrl: logoUrl || undefined,
          webhookUrl,
          minBetAmount: Math.round(parseFloat(minBet) * 100),
          maxBetAmount: Math.round(parseFloat(maxBet) * 100),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to register game.');
        setLoading(false);
        return;
      }

      if (data.webhookSecret) {
        toast('info', `Webhook secret: ${data.webhookSecret} - Save this now, it won't be shown again.`);
      }

      toast('success', 'Game registered successfully.');
      router.push(`/developer/games/${data.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-surface-400 hover:text-surface-200 transition-colors mb-2"
        >
          &larr; Back to games
        </button>
        <h1 className="text-2xl font-bold text-surface-100">Register New Game</h1>
      </div>

      <Card>
        <CardTitle>Game Details</CardTitle>
        <CardDescription>Register your game to start integrating PlayStake wagering.</CardDescription>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <Input
            label="Game Name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Battle Royale X"
            required
          />

          <Input
            label="Slug"
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
            placeholder="battle-royale-x"
            required
          />

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your game..."
              rows={3}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 text-surface-200 text-sm px-3 py-2 resize-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <Input
            label="Logo URL (optional)"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
          />

          <Input
            label="Webhook URL"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks/playstake"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Bet ($)"
              type="number"
              step="0.01"
              min="0.01"
              value={minBet}
              onChange={(e) => setMinBet(e.target.value)}
              prefix={<span className="text-sm font-medium">$</span>}
              required
            />
            <Input
              label="Max Bet ($)"
              type="number"
              step="0.01"
              min="0.01"
              value={maxBet}
              onChange={(e) => setMaxBet(e.target.value)}
              prefix={<span className="text-sm font-medium">$</span>}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Register Game
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
