'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  kycStatus: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}

let cachedUser: User | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

export function useUser() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    // Use cache if fresh
    if (cachedUser && Date.now() - cacheTime < CACHE_TTL) {
      setUser(cachedUser);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/user/profile');
      if (res.status === 401) {
        cachedUser = null;
        setUser(null);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      cachedUser = data;
      cacheTime = Date.now();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    cachedUser = null;
    cacheTime = 0;
    setUser(null);
    router.push('/login');
  }, [router]);

  const refresh = useCallback(() => {
    cachedUser = null;
    cacheTime = 0;
    fetchUser();
  }, [fetchUser]);

  return { user, loading, error, logout, refresh };
}
