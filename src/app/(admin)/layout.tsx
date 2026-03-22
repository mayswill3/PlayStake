'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthLayout } from '@/hooks/useAuthLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, balance, loading } = useAuthLayout({
    requiredRoles: ['ADMIN'],
    redirectTo: '/dashboard',
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar userRole={user?.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} balance={balance} />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
