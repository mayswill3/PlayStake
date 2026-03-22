'use client';

import { Button } from '@/components/ui/Button';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4" aria-hidden="true">⚠</div>
        <h2 className="text-xl font-bold text-surface-100 mb-2">Something went wrong</h2>
        <p className="text-sm text-surface-400 mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
