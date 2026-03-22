import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function AuthNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-surface-700 mb-2">404</div>
        <h2 className="text-xl font-bold text-surface-100 mb-2">Page not found</h2>
        <p className="text-sm text-surface-400 mb-6">
          This authentication page doesn&apos;t exist.
        </p>
        <Link href="/login">
          <Button>Go to Login</Button>
        </Link>
      </div>
    </div>
  );
}
