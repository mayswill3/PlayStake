'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
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
        <h1 className="text-2xl font-bold font-display text-text-primary mb-4">Invalid Link</h1>
        <p className="text-text-secondary font-mono mb-4">
          This password reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" className="text-brand-400 hover:text-brand-400 text-sm transition-colors">
          Request a new reset link
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold font-display text-text-primary mb-1">Set new password</h1>
      <p className="text-sm text-text-secondary font-mono mb-6">Enter your new password below.</p>

      {error && (
        <div className="mb-4 p-3 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 chars, 1 upper, 1 number, 1 special"
          required
          minLength={8}
          autoComplete="new-password"
        />

        <PasswordInput
          label="Confirm Password"
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
