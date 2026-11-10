'use client';

import { useState } from 'react';

/** "Didn't get it?" under the beta thank-you message. */
export function ResendBetaEmail({ email, className = '' }: { email: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function resend() {
    setState('sending');
    try {
      const res = await fetch('/api/beta-signup/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <p className={`text-sm text-ps-muted dark:text-ps-muted-on-dark ${className}`}>
      {state === 'sent' ? (
        <>Sent again. It comes from support@playstake.org; check your junk or spam folder too.</>
      ) : state === 'error' ? (
        <>We couldn&apos;t resend it just now. Please try again in a few minutes.</>
      ) : (
        <>
          Didn&apos;t get the email? Check your junk or spam folder, or{' '}
          <button type="button" onClick={resend} disabled={state === 'sending'} className="font-semibold underline disabled:opacity-60">
            {state === 'sending' ? 'sending…' : 'send it again'}
          </button>
          .
        </>
      )}
    </p>
  );
}
