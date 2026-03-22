'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
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
    <Card>
      <h1 className="text-2xl font-bold font-display text-text-primary mb-1">Reset your password</h1>
      <p className="text-sm text-text-secondary font-mono mb-6">
        Enter your email and we will send you a reset link.
      </p>

      {submitted ? (
        <div>
          <div className="p-4 rounded-sm bg-brand-500/10 border border-brand-500/25 text-brand-400 text-sm mb-4">
            If an account exists with that email, you will receive a password reset link shortly.
          </div>
          <Link
            href="/login"
            className="block text-center text-sm text-brand-400 hover:text-brand-400 transition-colors"
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
            className="block text-center text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Back to login
          </Link>
        </form>
      )}
    </Card>
  );
}
