import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { Spinner } from '@/components/ui/Spinner';

export const metadata: Metadata = {
  title: 'Sign in | PlayStake',
  description: 'Sign in to your PlayStake account.',
};

export default function LoginPage() {
  return (
    <div className="rounded-[1.15rem] bg-gradient-to-br from-ps-lime/70 via-ps-lime/20 to-ps-cyan/70 p-px shadow-ps-glow">
      <Suspense
        fallback={
          <div className="flex min-h-96 items-center justify-center rounded-[calc(1.15rem-1px)] bg-card">
            <Spinner size="lg" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
