'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body: Record<string, string> = { email, password };
      if (show2FA && twoFactorCode) {
        body.twoFactorCode = twoFactorCode;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 403 && data.twoFactorRequired) {
        setShow2FA(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold text-surface-100 mb-1">Welcome back</h1>
      <p className="text-sm text-surface-400 mb-6">Sign in to your PlayStake account</p>

      {registered && (
        <div className="mb-4 p-3 rounded-lg bg-brand-500/10 border border-brand-500/25 text-brand-300 text-sm">
          Account created successfully. Please log in.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm" role="alert">
          {error}
        </div>
      )}

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

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
        />

        {show2FA && (
          <Input
            label="Two-Factor Code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            required
            autoComplete="one-time-code"
          />
        )}

        <Button type="submit" loading={loading} className="w-full">
          {show2FA ? 'Verify & Sign In' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-surface-400 hover:text-surface-200 transition-colors">
          Forgot password?
        </Link>
        <Link href="/register" className="text-brand-400 hover:text-brand-300 transition-colors">
          Create account
        </Link>
      </div>
    </Card>
  );
}
