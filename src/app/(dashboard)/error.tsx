'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card>
        <div className="text-center py-8">
          <div className="text-4xl mb-4" aria-hidden="true">⚠</div>
          <h2 className="text-xl font-bold text-surface-100 mb-2">Something went wrong</h2>
          <p className="text-sm text-surface-400 mb-6">
            {error.message || 'An unexpected error occurred while loading this page.'}
          </p>
          <Button onClick={reset}>Try again</Button>
        </div>
      </Card>
    </div>
  );
}
