'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-danger-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-warning-400' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-blue-400' };
  return { score, label: 'Strong', color: 'bg-brand-500' };
}

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setFieldErrors({ email: 'This email is already registered.' });
        setLoading(false);
        return;
      }

      if (res.status === 422) {
        setError(data.error || 'Please check your input and try again.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      router.push('/login?registered=1');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-themed bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-display font-bold text-fg mb-1">Create your account</h1>
      <p className="text-sm text-fg-secondary mb-6">Start wagering on your favorite games</p>

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
        Sign up with Google
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
        <Input label="Display Name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="FragMaster99" required minLength={2} maxLength={32} autoComplete="username" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" error={fieldErrors.email} />

        <div>
          <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, 1 upper, 1 number, 1 special" required minLength={8} autoComplete="new-password" />
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${(strength.score / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-fg-secondary">{strength.label}</span>
              </div>
            </div>
          )}
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Create Account
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-fg-secondary">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-600 hover:text-brand-700 font-semibold transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
