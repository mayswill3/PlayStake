'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthLayout } from '@/hooks/useAuthLayout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, balance, loading } = useAuthLayout();

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
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
