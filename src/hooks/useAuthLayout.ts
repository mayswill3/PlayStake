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
    let cancelled = false;
    let retryTimer: number | undefined;

    const load = (attempt: number) =>
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
      ])
        .then(([userData, balanceData]) => {
          if (cancelled) return;
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
        })
        .catch(() => {
          // A rejected fetch is a network failure, not a failed session, so it
          // must never redirect to /login — that would sign people out over a
          // dropped connection. Uncaught it also left `loading` true forever,
          // stranding the whole dashboard on a spinner, and surfaced in Sentry
          // as an error. Retry once for the transient case.
          if (cancelled || attempt > 0) return;
          retryTimer = window.setTimeout(() => {
            if (!cancelled) void load(attempt + 1);
          }, 2000);
        });

    void load(0);

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [router, rolesKey, redirectTo]);

  return { user, balance, loading };
}
