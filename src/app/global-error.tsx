'use client';

// Catches errors thrown in the root layout, where error.tsx cannot reach.
// It replaces the whole document, so it must render <html> and <body> itself
// and cannot rely on any app styling being present.

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0F1C',
          color: '#F8FAFC',
          fontFamily:
            'ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif',
          padding: '1.5rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94A3B8', margin: '0 0 1.5rem' }}>
            The page failed to load. Your balance and any match in progress are
            unaffected.
          </p>
          {/*
            A plain anchor, deliberately: the root layout has failed, so the
            client router is not to be trusted. A full document load is the
            recovery, which is exactly what <Link> would avoid doing.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              background: '#5FDCB2',
              color: '#0A0F1C',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Back to PlayStake
          </a>
        </div>
      </body>
    </html>
  );
}
