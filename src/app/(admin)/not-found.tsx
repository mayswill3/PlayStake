import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminNotFound() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <EmptyState
        title="Page not found"
        description="The admin page you're looking for doesn't exist."
        action={
          <Link href="/admin">
            <Button variant="secondary">Back to Admin Dashboard</Button>
          </Link>
        }
      />
    </div>
  );
}
