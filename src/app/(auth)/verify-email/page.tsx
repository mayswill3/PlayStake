'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token provided.');
      return;
    }

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setErrorMsg(data.error || 'Invalid or expired verification token.');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('Something went wrong. Please try again.');
      });
  }, [token]);

  return (
    <div className="rounded-2xl border border-themed bg-card p-8 shadow-sm">
      {status === 'loading' && (
        <div className="flex flex-col items-center py-8">
          <Spinner size="lg" />
          <p className="mt-4 text-fg-secondary">Verifying your email...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-600/15 text-brand-600 dark:text-brand-400 text-3xl mb-4">
            &#10003;
          </div>
          <h1 className="text-2xl font-bold font-display text-fg mb-2">Email Verified</h1>
          <p className="text-fg-secondary mb-6">Your email has been verified successfully.</p>
          <Link
            href="/login"
            className="inline-flex items-center h-11 px-5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Continue to Login
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-500/15 text-danger-500 text-3xl mb-4">
            &#10007;
          </div>
          <h1 className="text-2xl font-bold font-display text-fg mb-2">Verification Failed</h1>
          <p className="text-fg-secondary mb-6">{errorMsg}</p>
          <Link
            href="/login"
            className="text-brand-600 hover:text-brand-700 font-semibold text-sm transition-colors"
          >
            Back to login
          </Link>
        </div>
      )}
    </div>
  );
}
