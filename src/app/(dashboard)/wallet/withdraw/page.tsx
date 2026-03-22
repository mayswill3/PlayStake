'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatCents } from '@/lib/utils/format';

export default function WithdrawPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [available, setAvailable] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  const amountCents = Math.round(parseFloat(amount || '0') * 100);

  useEffect(() => {
    fetch('/api/wallet/balance')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setAvailable(data.available);
      })
      .finally(() => setPageLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (amountCents < 1000) {
      setError('Minimum withdrawal is $10.00');
      return;
    }
    if (available !== null && amountCents > available) {
      setError('Amount exceeds available balance.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountCents,
          idempotencyKey: `wd_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setError('Your email must be verified before you can withdraw. Check your inbox.');
        } else {
          setError(data.error || 'Withdrawal failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      toast('success', `Withdrawal of ${formatCents(amountCents)} has been submitted.`);
      router.push('/wallet');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">Withdraw Funds</h1>
        <p className="text-text-secondary font-mono text-sm mt-1">Transfer funds to your bank account</p>
      </div>

      <Card>
        <div className="mb-6 p-4 rounded-sm bg-surface-800">
          <p className="text-sm text-text-secondary font-mono">Available Balance</p>
          <p className="text-2xl font-bold font-display text-brand-400">
            {formatCents(available ?? 0)}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm font-mono" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="10"
            max={available !== null ? (available / 100).toFixed(2) : undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50.00"
            prefix={<span className="text-sm font-medium">$</span>}
            required
          />

          {available !== null && (
            <button
              type="button"
              onClick={() => setAmount((available / 100).toFixed(2))}
              className="text-sm text-brand-400 hover:text-brand-400 transition-colors"
            >
              Withdraw all ({formatCents(available)})
            </button>
          )}

          <div className="text-xs text-text-muted">
            Min $10.00 &middot; Funds typically arrive in 1-3 business days
          </div>

          <Button type="submit" loading={loading} className="w-full">
            Withdraw {amountCents > 0 ? formatCents(amountCents) : ''}
          </Button>
        </form>
      </Card>

      <Button variant="ghost" onClick={() => router.back()} className="w-full">
        Cancel
      </Button>
    </div>
  );
}
