'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { FadeIn } from '@/components/ui/FadeIn';
import { Users } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  kycStatus: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'PLAYER', label: 'Player' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const roleVariant = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'danger' as const;
      case 'DEVELOPER': return 'info' as const;
      default: return 'neutral' as const;
    }
  };

  const kycVariant = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'success' as const;
      case 'PENDING': return 'warning' as const;
      case 'REJECTED': return 'danger' as const;
      default: return 'neutral' as const;
    }
  };

  return (
    <FadeIn>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-display font-bold text-text-primary">User Management</h1>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setRoleFilter(opt.value); setPage(1); }}
                className={`
                  px-3 py-1.5 rounded-sm font-mono text-[11px] uppercase tracking-wider font-medium transition-colors
                  ${roleFilter === opt.value
                    ? 'bg-brand-400/10 text-brand-400 border border-brand-400/25'
                    : 'text-text-muted hover:text-text-secondary border border-surface-700 hover:border-surface-600'
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input type="text" placeholder="Search by email or name..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            <button
              type="submit"
              className="px-4 py-2 rounded-sm bg-surface-700 text-text-primary font-mono text-sm font-medium hover:bg-surface-600 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : error ? (
          <div className="p-4 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm font-mono">{error}</div>
        ) : users.length === 0 ? (
          <Card>
            <EmptyState icon={<Users className="h-10 w-10" />} title="No users found" description="No users match the current filters." />
          </Card>
        ) : (
          <>
            <Card padding="none" className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-white/8">
                    <tr>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">User</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Role</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">KYC</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Verified</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Joined</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/users/${user.id}`} className="hover:text-brand-400 transition-colors">
                            <p className="font-mono font-medium text-surface-200">{user.displayName}</p>
                            <p className="text-xs font-mono text-text-muted">{user.email}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3"><Badge variant={roleVariant(user.role)}>{user.role}</Badge></td>
                        <td className="px-4 py-3"><Badge variant={kycVariant(user.kycStatus)}>{user.kycStatus}</Badge></td>
                        <td className="px-4 py-3">
                          <span className={`font-mono ${user.emailVerified ? 'text-brand-400' : 'text-text-muted'}`}>
                            {user.emailVerified ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-text-secondary">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-text-secondary">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && <div className="px-4 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>}
            </Card>

            <div className="sm:hidden space-y-3">
              {users.map((user) => (
                <Link key={user.id} href={`/admin/users/${user.id}`}>
                  <Card className="hover:border-surface-600 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-medium text-surface-200 truncate">{user.displayName}</p>
                        <p className="text-xs font-mono text-text-muted mt-0.5">{user.email}</p>
                      </div>
                      <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={kycVariant(user.kycStatus)}>{user.kycStatus}</Badge>
                      <span className="text-xs font-mono text-text-muted">Joined {formatDate(user.createdAt)}</span>
                    </div>
                  </Card>
                </Link>
              ))}
              {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
            </div>
          </>
        )}
      </div>
    </FadeIn>
  );
}
