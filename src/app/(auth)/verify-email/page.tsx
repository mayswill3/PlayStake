'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
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
    <Card>
      {status === 'loading' && (
        <div className="flex flex-col items-center py-8">
          <Spinner size="lg" />
          <p className="mt-4 text-surface-400">Verifying your email...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/15 text-brand-400 text-3xl mb-4">
            &#10003;
          </div>
          <h1 className="text-2xl font-bold text-surface-100 mb-2">Email Verified</h1>
          <p className="text-surface-400 mb-6">Your email has been verified successfully.</p>
          <Link
            href="/login"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
          >
            Continue to Login
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-500/15 text-danger-400 text-3xl mb-4">
            &#10007;
          </div>
          <h1 className="text-2xl font-bold text-surface-100 mb-2">Verification Failed</h1>
          <p className="text-surface-400 mb-6">{errorMsg}</p>
          <Link
            href="/login"
            className="text-brand-400 hover:text-brand-300 text-sm transition-colors"
          >
            Back to login
          </Link>
        </div>
      )}
    </Card>
  );
}
