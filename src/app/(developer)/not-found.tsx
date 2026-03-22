import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DeveloperNotFound() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <EmptyState
        title="Page not found"
        description="The developer page you're looking for doesn't exist."
        action={
          <Link href="/developer">
            <Button variant="secondary">Back to Developer Portal</Button>
          </Link>
        }
      />
    </div>
  );
}
