'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/Button';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // This boundary is where most page errors surface; report before rendering
  // the apology, so a user hitting it doesn't have to tell us about it.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4" aria-hidden="true">⚠</div>
        <h2 className="text-xl font-bold text-surface-100 mb-2">Something went wrong</h2>
        {/*
          Never render error.message. Next redacts server-component errors, but
          a client-side throw surfaces verbatim — and on this product that can
          mean a database constraint, an internal path, or a provider's error
          text. The detail goes to Sentry; the user gets the digest, which is
          the reference support can search on.
        */}
        <p className="text-sm text-surface-400 mb-6">
          Something went wrong on our side. Your balance and any match in
          progress are unaffected.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-surface-500 mb-6">
            Reference: {error.digest}
          </p>
        )}
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
