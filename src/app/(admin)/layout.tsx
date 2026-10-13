'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardTitle } from '@/components/ui/Card';
import { useAuthLayout } from '@/hooks/useAuthLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, balance, loading } = useAuthLayout({
    requiredRoles: ['ADMIN'],
    redirectTo: '/dashboard',
  });

  // The admin API refuses staff without two-factor in production (see
  // adminTwoFactorRequired), so say so rather than letting every page fail.
  const needsTwoFactor =
    process.env.NODE_ENV === 'production' && user !== null && !user.twoFactorEnabled;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar userRole={user?.role} kycStatus={user?.kycStatus} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} balance={balance} />
        <main className="flex-1 p-4 lg:p-6">
          {needsTwoFactor ? <TwoFactorRequired /> : children}
        </main>
      </div>
    </div>
  );
}

function TwoFactorRequired() {
  return (
    <Card className="mx-auto max-w-xl border-l-4 border-l-[var(--ps-warning)]">
      <CardTitle>Turn on two-factor authentication</CardTitle>
      <p className="mt-2 text-sm text-text-secondary">
        Admin tools can move money and show identity documents, so they only work once your
        account has two-factor sign-in. Set it up with an authenticator app, then come back here.
      </p>
      <Link
        href="/settings#security"
        className="mt-4 inline-flex h-10 items-center rounded-[var(--ps-radius-md)] bg-[var(--ps-lime)] px-5 text-sm font-bold text-ps-ink hover:brightness-95"
      >
        Go to Settings
      </Link>
    </Card>
  );
}
