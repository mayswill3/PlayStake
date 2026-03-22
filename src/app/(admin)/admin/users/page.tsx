'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-surface-100">User Management</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setRoleFilter(opt.value); setPage(1); }}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${roleFilter === opt.value
                  ? 'bg-brand-600/15 text-brand-400 border border-brand-500/25'
                  : 'text-surface-400 hover:text-surface-200 border border-surface-700 hover:border-surface-600'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="Search by email or name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-surface-700 text-surface-100 text-sm font-medium hover:bg-surface-600 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm">
          {error}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <EmptyState
            title="No users found"
            description="No users match the current filters."
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card padding="none" className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-surface-400 border-b border-surface-800">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">KYC</th>
                    <th className="px-4 py-3">Verified</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${user.id}`} className="hover:text-brand-400 transition-colors">
                          <p className="font-medium text-surface-200">{user.displayName}</p>
                          <p className="text-xs text-surface-500">{user.email}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={kycVariant(user.kycStatus)}>{user.kycStatus}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={user.emailVerified ? 'text-brand-400' : 'text-surface-500'}>
                          {user.emailVerified ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-400">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-surface-400">
                        {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-4 pb-4">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </Card>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {users.map((user) => (
              <Link key={user.id} href={`/admin/users/${user.id}`}>
                <Card className="hover:border-surface-700 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-200 truncate">{user.displayName}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{user.email}</p>
                    </div>
                    <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={kycVariant(user.kycStatus)}>{user.kycStatus}</Badge>
                    <span className="text-xs text-surface-500">Joined {formatDate(user.createdAt)}</span>
                  </div>
                </Card>
              </Link>
            ))}
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
