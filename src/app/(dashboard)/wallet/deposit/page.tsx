'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatCents } from '@/lib/utils/format';

const PRESETS = [1000, 2500, 5000, 10000]; // cents

export default function DepositPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const amountCents = Math.round(parseFloat(amount || '0') * 100);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (amountCents < 500) {
      setError('Minimum deposit is $5.00');
      return;
    }
    if (amountCents > 100000) {
      setError('Maximum deposit is $1,000.00');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountCents,
          idempotencyKey: `dep_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Deposit failed. Please try again.');
        setLoading(false);
        return;
      }

      // Simulate payment processing (Stripe is stubbed)
      setLoading(false);
      setProcessing(true);

      setTimeout(() => {
        setProcessing(false);
        toast('success', `Deposit of ${formatCents(amountCents)} is being processed.`);
        router.push('/wallet');
      }, 2000);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (processing) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-brand-500/15 flex items-center justify-center mb-4">
              <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-surface-100 mb-2">Processing Payment</h2>
            <p className="text-sm text-surface-400 text-center">
              Your deposit of {formatCents(amountCents)} is being processed.
              This usually takes a few seconds.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-100">Deposit Funds</h1>
        <p className="text-surface-400 text-sm mt-1">Add funds to your PlayStake wallet</p>
      </div>

      <Card>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="5"
            max="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="25.00"
            prefix={<span className="text-sm font-medium">$</span>}
            required
          />

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount((preset / 100).toFixed(2))}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${amountCents === preset
                    ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                    : 'border-surface-700 text-surface-400 hover:border-surface-600 hover:text-surface-200'
                  }
                `}
              >
                {formatCents(preset)}
              </button>
            ))}
          </div>

          <div className="text-xs text-surface-500">
            Min $5.00 &middot; Max $1,000.00 &middot; Processed via Stripe
          </div>

          <Button type="submit" loading={loading} className="w-full">
            Deposit {amountCents > 0 ? formatCents(amountCents) : ''}
          </Button>
        </form>
      </Card>

      <Button variant="ghost" onClick={() => router.back()} className="w-full">
        Cancel
      </Button>
    </div>
  );
}
