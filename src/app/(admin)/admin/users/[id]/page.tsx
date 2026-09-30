'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
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
  dateOfBirth: string | null;
  marketingConsent: boolean;
  accountStatus: string;
  accountStatusReason: string | null;
  accountStatusChangedAt: string | null;
  gamstopStatus: string | null;
  gamstopCheckedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  balance: number;
  totalBets: number;
  disputesFiled: number;
  activeBreak: null | { type: string; endsAt: string; awaitingReturn: boolean };
  openRiskSignals: number;
  openAmlCases: number;
  complaints: number;
}

/** A change waiting for the admin to give a reason and confirm. */
type PendingChange =
  | { kind: 'role'; value: string }
  | { kind: 'kyc'; value: string }
  | { kind: 'status'; value: string };

const STATUS_ACTIONS: { value: string; label: string; danger?: boolean }[] = [
  { value: 'ACTIVE', label: 'Reinstate' },
  { value: 'SUSPENDED', label: 'Suspend' },
  { value: 'CLOSED', label: 'Close account', danger: true },
  { value: 'CLOSED_UNDERAGE', label: 'Close as under-18', danger: true },
];

const CHANGE_TITLE: Record<PendingChange['kind'], string> = {
  role: 'Change role',
  kyc: 'Change KYC status',
  status: 'Change account status',
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${params.id}`, { cache: 'no-store' });
      setUser(res.ok ? await res.json() : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  function begin(change: PendingChange) {
    setReason('');
    setPending(change);
  }

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    try {
      const res =
        pending.kind === 'status'
          ? await fetch(`/api/admin/users/${params.id}/account-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: pending.value, reason }),
            })
          : await fetch(`/api/admin/users/${params.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(
                pending.kind === 'role'
                  ? { role: pending.value, reason }
                  : { kycStatus: pending.value, reason },
              ),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast('error', data.error || 'Could not make that change.');
        return;
      }
      toast(
        'success',
        pending.kind === 'status' && data.voidedBetIds?.length
          ? `Done. ${data.voidedBetIds.length} unsettled bet(s) voided and stakes returned.`
          : 'Change saved and recorded in the audit log.',
      );
      setPending(null);
      await load();
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
      <div className="p-4 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm">
        User not found.
      </div>
    );
  }

  const closedUnderage = user.accountStatus === 'CLOSED_UNDERAGE';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-text-primary">{user.displayName}</h1>
          <p className="text-text-secondary font-mono text-sm mt-1">{user.email}</p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/admin/users')}>
          Back to Users
        </Button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-text-secondary font-mono mb-1">Balance</p>
          <p className="text-2xl font-bold font-display text-brand-400">{formatCents(Math.round(user.balance * 100))}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary font-mono mb-1">Total Bets</p>
          <p className="text-2xl font-bold font-display text-text-primary">{user.totalBets}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary font-mono mb-1">Disputes Filed</p>
          <p className="text-2xl font-bold font-display text-text-primary">{user.disputesFiled}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary font-mono mb-1">Open harm signals</p>
          <p className="text-2xl font-bold font-display text-text-primary">{user.openRiskSignals}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary font-mono mb-1">Open AML cases</p>
          <p className="text-2xl font-bold font-display text-text-primary">{user.openAmlCases}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary font-mono mb-1">Complaints</p>
          <p className="text-2xl font-bold font-display text-text-primary">{user.complaints}</p>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardTitle>Account Details</CardTitle>
        <div className="mt-4 space-y-3">
          <DetailRow label="User ID" value={user.id} />
          <DetailRow label="Joined" value={formatDate(user.createdAt)} />
          <DetailRow label="Last Login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'} />
          <DetailRow label="Date of birth (declared)" value={user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : 'Not given'} />
          <DetailRow label="Email Verified" value={user.emailVerified ? 'Yes' : 'No'} />
          <DetailRow label="2FA Enabled" value={user.twoFactorEnabled ? 'Yes' : 'No'} />
          <DetailRow label="Marketing consent" value={user.marketingConsent ? 'Opted in' : 'No'} />
          <DetailRow
            label="GAMSTOP"
            value={
              user.gamstopStatus
                ? `${user.gamstopStatus.replace(/_/g, ' ')}${user.gamstopCheckedAt ? ` · checked ${formatDate(user.gamstopCheckedAt)}` : ''}`
                : 'Not checked'
            }
          />
          <DetailRow
            label="Break"
            value={
              user.activeBreak
                ? `${user.activeBreak.type.replace(/_/g, ' ')}${user.activeBreak.awaitingReturn ? ' · ended, not returned' : ` until ${formatDate(user.activeBreak.endsAt)}`}`
                : 'None'
            }
          />
        </div>
      </Card>

      {/* Account status */}
      <Card>
        <CardTitle>Account Status</CardTitle>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={user.accountStatus === 'ACTIVE' ? 'success' : user.accountStatus === 'SUSPENDED' ? 'warning' : 'danger'}>
              {user.accountStatus.replace(/_/g, ' ')}
            </Badge>
            {user.accountStatusReason && (
              <span className="text-sm text-text-secondary">
                {user.accountStatusReason}
                {user.accountStatusChangedAt ? ` · ${formatDate(user.accountStatusChangedAt)}` : ''}
              </span>
            )}
          </div>
          {closedUnderage ? (
            <p className="text-sm text-text-secondary">
              Closed as under-18. This can&apos;t be reversed; return the balance to the customer
              and review any settled winnings as set out in the Age Verification Policy.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {STATUS_ACTIONS.filter((action) => action.value !== user.accountStatus).map((action) => (
                <Button
                  key={action.value}
                  variant={action.danger ? 'danger' : 'ghost'}
                  size="sm"
                  onClick={() => begin({ kind: 'status', value: action.value })}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
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
              <Button key={role} variant="ghost" size="sm" onClick={() => begin({ kind: 'role', value: role })}>
                Set {role}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* KYC Management */}
      <Card>
        <CardTitle>KYC Status</CardTitle>
        <p className="mt-1 text-sm text-text-secondary">
          Approve identity from the KYC queue. Marking someone verified here only works
          when an approved document already shows they are 18 or over.
        </p>
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
                <Button key={status} variant="ghost" size="sm" onClick={() => begin({ kind: 'kyc', value: status })}>
                  Set {status}
                </Button>
              ))}
          </div>
        </div>
      </Card>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `${CHANGE_TITLE[pending.kind]} to ${pending.value.replace(/_/g, ' ')}` : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button
              variant={pending?.value.startsWith('CLOSED') ? 'danger' : 'primary'}
              loading={saving}
              disabled={reason.trim().length < 10}
              onClick={confirm}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-text-secondary">
          {pending?.value === 'CLOSED_UNDERAGE' && (
            <p>
              Every unsettled bet this customer is in will be voided and both stakes returned,
              and they will be signed out everywhere. This cannot be undone.
            </p>
          )}
          <label className="block">
            <span className="mb-1 block text-text-primary">Reason (recorded in the audit log)</span>
            <textarea
              className="w-full min-h-[90px] resize-y rounded-sm border border-surface-700 bg-surface-800 p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="At least 10 characters"
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-white/8 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-right text-sm text-text-primary font-mono">{value}</span>
    </div>
  );
}
