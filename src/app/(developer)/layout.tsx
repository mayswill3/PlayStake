'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Spinner } from '@/components/ui/Spinner';
import type { User } from '@/hooks/useUser';
import type { Balance } from '@/hooks/useBalance';

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/user/profile').then(async (r) => {
        if (r.status === 401) return null;
        if (!r.ok) return null;
        return r.json();
      }),
      fetch('/api/wallet/balance').then(async (r) => {
        if (!r.ok) return null;
        return r.json();
      }),
    ]).then(([userData, balanceData]) => {
      if (!userData) {
        router.push('/login');
        return;
      }
      if (userData.role !== 'DEVELOPER' && userData.role !== 'ADMIN') {
        router.push('/dashboard');
        return;
      }
      setUser(userData);
      setBalance(balanceData);
      setLoading(false);
    });
  }, [router]);

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
