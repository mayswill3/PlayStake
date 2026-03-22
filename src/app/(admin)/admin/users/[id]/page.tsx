'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatCents, formatDate } from '@/lib/utils/format';

interface UserDetail {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  kycStatus: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  balance: number;
  totalBets: number;
  disputesFiled: number;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load user');
        return r.json();
      })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleRoleChange(role: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast('error', data.error || 'Failed to update role.');
      } else {
        setUser((prev) => prev ? { ...prev, role } : prev);
        toast('success', `Role updated to ${role}.`);
      }
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function handleKycChange(kycStatus: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kycStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast('error', data.error || 'Failed to update KYC status.');
      } else {
        setUser((prev) => prev ? { ...prev, kycStatus } : prev);
        toast('success', `KYC status updated to ${kycStatus}.`);
      }
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm">
        User not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">{user.displayName}</h1>
          <p className="text-surface-400 text-sm mt-1">{user.email}</p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/admin/users')}>
          Back to Users
        </Button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-surface-400 mb-1">Balance</p>
          <p className="text-2xl font-bold text-brand-400">{formatCents(user.balance)}</p>
        </Card>
        <Card>
          <p className="text-sm text-surface-400 mb-1">Total Bets</p>
          <p className="text-2xl font-bold text-surface-100">{user.totalBets}</p>
        </Card>
        <Card>
          <p className="text-sm text-surface-400 mb-1">Disputes Filed</p>
          <p className="text-2xl font-bold text-surface-100">{user.disputesFiled}</p>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardTitle>Account Details</CardTitle>
        <div className="mt-4 space-y-3">
          <DetailRow label="User ID" value={user.id} />
          <DetailRow label="Joined" value={formatDate(user.createdAt)} />
          <DetailRow label="Last Login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'} />
          <DetailRow label="Email Verified" value={user.emailVerified ? 'Yes' : 'No'} />
          <DetailRow label="2FA Enabled" value={user.twoFactorEnabled ? 'Yes' : 'No'} />
        </div>
      </Card>

      {/* Role Management */}
      <Card>
        <CardTitle>Role</CardTitle>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant={user.role === 'ADMIN' ? 'danger' : user.role === 'DEVELOPER' ? 'info' : 'neutral'}>
            {user.role}
          </Badge>
          <div className="flex gap-2">
            {['PLAYER', 'DEVELOPER', 'ADMIN'].filter((r) => r !== user.role).map((role) => (
              <Button
                key={role}
                variant="ghost"
                size="sm"
                loading={saving}
                onClick={() => handleRoleChange(role)}
              >
                Set {role}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* KYC Management */}
      <Card>
        <CardTitle>KYC Status</CardTitle>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge
            variant={
              user.kycStatus === 'VERIFIED' ? 'success' :
              user.kycStatus === 'REJECTED' ? 'danger' :
              user.kycStatus === 'PENDING' ? 'warning' : 'neutral'
            }
          >
            {user.kycStatus}
          </Badge>
          <div className="flex gap-2">
            {['NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED']
              .filter((s) => s !== user.kycStatus)
              .map((status) => (
                <Button
                  key={status}
                  variant="ghost"
                  size="sm"
                  loading={saving}
                  onClick={() => handleKycChange(status)}
                >
                  Set {status}
                </Button>
              ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
      <span className="text-sm text-surface-400">{label}</span>
      <span className="text-sm text-surface-200 font-mono">{value}</span>
    </div>
  );
}
