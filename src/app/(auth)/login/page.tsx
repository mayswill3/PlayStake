'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const googleError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    const messages: Record<string, string> = {
      google_denied: 'Google sign-in was cancelled.',
      google_unverified: 'Your Google email is not verified.',
      google_failed: 'Google sign-in failed. Please try again.',
      google_invalid: 'Invalid Google sign-in request. Please try again.',
      account_deleted: 'This account has been deleted.',
    };
    return googleError ? messages[googleError] || '' : '';
  });

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

      router.push(redirectTo);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-themed bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-display font-bold text-fg mb-1">Welcome back</h1>
      <p className="text-sm text-fg-secondary mb-6">Sign in to your PlayStake account</p>

      {registered && (
        <div className="mb-4 p-3 rounded-lg bg-brand-600/10 border border-brand-600/25 text-brand-700 dark:text-brand-400 text-sm">
          Account created successfully. Please log in.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-500 text-sm" role="alert">
          {error}
        </div>
      )}

      <a
        href="/api/auth/google"
        className="flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-lg border border-themed bg-elevated hover:bg-page transition-colors text-sm font-medium text-fg"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </a>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-themed" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-fg-muted">or</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
        <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password" />

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
        <Link href="/forgot-password" className="text-fg-secondary hover:text-fg transition-colors">
          Forgot password?
        </Link>
        <Link href="/register" className="text-brand-600 hover:text-brand-700 font-semibold transition-colors">
          Create account
        </Link>
      </div>
    </div>
  );
}
