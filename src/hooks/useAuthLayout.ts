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

  // Callers pass inline array literals (e.g. `requiredRoles: ['ADMIN']`), which
  // are a new reference every render. Depending on the array directly re-runs
  // the effect after every fetch's setState — an infinite refetch loop. Key the
  // effect on the joined string instead so it only re-runs on a real change.
  const rolesKey = requiredRoles?.join(',');

  useEffect(() => {
    const roles = rolesKey ? rolesKey.split(',') : undefined;
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
      if (roles && !roles.includes(userData.role)) {
        router.push(redirectTo);
        return;
      }
      setUser(userData);
      setBalance(balanceData);
      setLoading(false);
    });
  }, [router, rolesKey, redirectTo]);

  return { user, balance, loading };
}
