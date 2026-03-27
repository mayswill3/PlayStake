'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
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
  return { score, label: 'Strong', color: 'bg-brand-400' };
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
    <Card>
      <h1 className="text-2xl font-display font-bold text-text-primary mb-1">Create your account</h1>
      <p className="text-sm font-mono text-text-secondary mb-6">Start wagering on your favorite games</p>

      {error && (
        <div className="mb-4 p-3 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm font-mono" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Display Name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="FragMaster99" required minLength={2} maxLength={32} autoComplete="username" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" error={fieldErrors.email} />

        <div>
          <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, 1 upper, 1 number, 1 special" required minLength={8} autoComplete="new-password" />
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-sm bg-surface-800 overflow-hidden">
                  <div
                    className={`h-full rounded-sm transition-all duration-300 ${strength.color}`}
                    style={{ width: `${(strength.score / 5) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-text-secondary">{strength.label}</span>
              </div>
            </div>
          )}
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Create Account
        </Button>
      </form>

      <p className="mt-4 text-center text-sm font-mono text-text-secondary">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-400 hover:text-brand-500 transition-colors">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
