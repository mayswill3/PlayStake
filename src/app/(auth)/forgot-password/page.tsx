'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Always show success to prevent email enumeration
    }

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-themed bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold font-display text-fg mb-1">Reset your password</h1>
      <p className="text-sm text-fg-secondary mb-6">
        Enter your email and we will send you a reset link.
      </p>

      {submitted ? (
        <div>
          <div className="p-4 rounded-lg bg-brand-600/10 border border-brand-600/25 text-brand-700 dark:text-brand-400 text-sm mb-4">
            If an account exists with that email, you will receive a password reset link shortly.
          </div>
          <Link
            href="/login"
            className="block text-center text-sm text-brand-600 hover:text-brand-700 font-semibold transition-colors"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />

          <Button type="submit" loading={loading} className="w-full">
            Send Reset Link
          </Button>

          <Link
            href="/login"
            className="block text-center text-sm text-fg-secondary hover:text-fg transition-colors"
          >
            Back to login
          </Link>
        </form>
      )}
    </div>
  );
}
