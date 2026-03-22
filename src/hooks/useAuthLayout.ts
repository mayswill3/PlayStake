'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/hooks/useUser';
import type { Balance } from '@/hooks/useBalance';

interface UseAuthLayoutOptions {
  requiredRoles?: string[];
  redirectTo?: string;
}

interface AuthLayoutState {
  user: User | null;
  balance: Balance | null;
  loading: boolean;
}

export function useAuthLayout(options: UseAuthLayoutOptions = {}): AuthLayoutState {
  const { requiredRoles, redirectTo = '/dashboard' } = options;
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
      if (requiredRoles && !requiredRoles.includes(userData.role)) {
        router.push(redirectTo);
        return;
      }
      setUser(userData);
      setBalance(balanceData);
      setLoading(false);
    });
  }, [router, requiredRoles, redirectTo]);

  return { user, balance, loading };
}
