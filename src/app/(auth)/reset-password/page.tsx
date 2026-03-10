'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. The link may have expired.');
        setLoading(false);
        return;
      }

      router.push('/login');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card>
        <h1 className="text-2xl font-bold text-surface-100 mb-4">Invalid Link</h1>
        <p className="text-surface-400 mb-4">
          This password reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" className="text-brand-400 hover:text-brand-300 text-sm transition-colors">
          Request a new reset link
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold text-surface-100 mb-1">Set new password</h1>
      <p className="text-sm text-surface-400 mb-6">Enter your new password below.</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 chars, 1 upper, 1 number, 1 special"
          required
          minLength={8}
          autoComplete="new-password"
        />

        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat your password"
          required
          minLength={8}
          autoComplete="new-password"
        />

        <Button type="submit" loading={loading} className="w-full">
          Reset Password
        </Button>
      </form>
    </Card>
  );
}
