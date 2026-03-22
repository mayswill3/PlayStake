'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatCents } from '@/lib/utils/format';

// ---------------------------------------------------------------------------
// Stripe.js singleton (loaded once on the client)
// ---------------------------------------------------------------------------

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

// ---------------------------------------------------------------------------
// Preset amounts
// ---------------------------------------------------------------------------

const PRESETS = [1000, 2500, 5000, 10000]; // cents

// ---------------------------------------------------------------------------
// Inner form wrapped in <Elements> to access Stripe hooks
// ---------------------------------------------------------------------------

function CheckoutForm({
  amountCents,
  transactionId,
  onCancel,
}: {
  amountCents: number;
  transactionId: string;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { toast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;

      setSubmitting(true);
      setError('');

      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/wallet?deposit=success&txn=${transactionId}`,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed. Please try again.');
        setSubmitting(false);
        return;
      }

      // If we reach here without redirect, payment succeeded inline
      toast('success', `Deposit of ${formatCents(amountCents)} is being processed.`);
      router.push('/wallet?deposit=success');
    },
    [stripe, elements, amountCents, transactionId, router, toast]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          className="p-3 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      <div className="text-sm text-text-secondary font-mono text-center">
        You will be charged <span className="font-semibold text-text-primary">{formatCents(amountCents)}</span>
      </div>

      <Button type="submit" loading={submitting} disabled={!stripe || !elements} className="w-full">
        {submitting ? 'Processing...' : `Pay ${formatCents(amountCents)}`}
      </Button>

      <Button type="button" variant="ghost" onClick={onCancel} className="w-full">
        Change Amount
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main deposit page
// ---------------------------------------------------------------------------

export default function DepositPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Stripe Elements state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

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

      // Store the client secret and transition to the payment form
      setClientSecret(data.stripeClientSecret);
      setTransactionId(data.transactionId);
      setLoading(false);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  // If we have a client secret, show the Stripe payment form
  if (clientSecret && transactionId) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-text-primary">Complete Payment</h1>
          <p className="text-text-secondary font-mono text-sm mt-1">
            Enter your payment details to deposit {formatCents(amountCents)}
          </p>
        </div>

        <Card>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#6366f1',
                  colorBackground: '#1e1e2e',
                  colorText: '#e2e8f0',
                  colorDanger: '#ef4444',
                  borderRadius: '8px',
                  fontFamily: 'inherit',
                },
              },
            }}
          >
            <CheckoutForm
              amountCents={amountCents}
              transactionId={transactionId}
              onCancel={() => {
                setClientSecret(null);
                setTransactionId(null);
              }}
            />
          </Elements>
        </Card>
      </div>
    );
  }

  // Amount selection form
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-text-primary">Deposit Funds</h1>
        <p className="text-text-secondary font-mono text-sm mt-1">Add funds to your PlayStake wallet</p>
      </div>

      <Card>
        {error && (
          <div className="mb-4 p-3 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm" role="alert">
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
                  px-4 py-2 rounded-sm text-sm font-medium border transition-colors
                  ${amountCents === preset
                    ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                    : 'border-surface-700 text-text-secondary hover:border-surface-600 hover:text-text-primary'
                  }
                `}
              >
                {formatCents(preset)}
              </button>
            ))}
          </div>

          <div className="text-xs text-text-muted">
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
