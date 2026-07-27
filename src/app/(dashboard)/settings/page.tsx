'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog } from '@/components/ui/Dialog';
import { FadeIn } from '@/components/ui/FadeIn';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { PSButton } from '@/components/ui/playstake/PSButton';

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFASaving, setTwoFASaving] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/user/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setProfile(data);
          setDisplayName(data.displayName);
          setAvatarUrl(data.avatarUrl || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, avatarUrl: avatarUrl || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast('error', data.error || 'Failed to update profile.');
      } else {
        const updated = await res.json();
        setProfile(updated);
        toast('success', 'Profile updated.');
      }
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast('error', 'Passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast('error', data.error || 'Failed to change password.');
      } else {
        toast('success', 'Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleEnable2FA() {
    try {
      const res = await fetch('/api/auth/2fa/enable', { method: 'POST' });
      if (!res.ok) { toast('error', 'Failed to enable 2FA.'); return; }
      const data = await res.json();
      setTwoFASecret(data.secret);
      setTwoFAOpen(true);
    } catch {
      toast('error', 'Something went wrong.');
    }
  }

  async function handleConfirm2FA() {
    if (twoFACode.length !== 6) return;
    setTwoFASaving(true);
    try {
      const res = await fetch('/api/auth/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFACode }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast('error', data.error || 'Invalid code. Please try again.');
        setTwoFASaving(false);
        return;
      }
      const data = await res.json();
      setBackupCodes(data.backupCodes || []);
      setProfile((prev) => prev ? { ...prev, twoFactorEnabled: true } : prev);
      toast('success', 'Two-factor authentication enabled.');
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setTwoFASaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <FadeIn>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-display font-bold text-ps-text dark:text-ps-text-on-dark">Settings</h1>

        <Card className="bg-ps-paper-elevated dark:bg-ps-ink-2 border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name and avatar.</CardDescription>
          <form onSubmit={handleProfileSave} className="space-y-4 mt-4">
            <Input
              label="Email"
              type="email"
              value={profile?.email || ''}
              disabled
              suffix={
                profile?.emailVerified
                  ? <Badge variant="success">Verified</Badge>
                  : <Badge variant="warning">Unverified</Badge>
              }
            />
            <Input
              label="Display Name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              minLength={2}
              maxLength={32}
            />
            <Input
              label="Avatar URL"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
            <div className="flex justify-end">
              <PSButton type="submit" loading={profileSaving}>Save Profile</PSButton>
            </div>
          </form>
        </Card>

        <Card className="bg-ps-paper-elevated dark:bg-ps-ink-2 border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
          <CardTitle>Security</CardTitle>
          <CardDescription>Manage your password and two-factor authentication.</CardDescription>
          <form onSubmit={handlePasswordChange} className="space-y-4 mt-4">
            <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            <div className="flex justify-end">
              <PSButton type="submit" loading={passwordSaving}>Change Password</PSButton>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-display font-medium text-ps-text dark:text-ps-text-on-dark">Two-Factor Authentication</p>
                <p className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark mt-0.5">
                  {profile?.twoFactorEnabled
                    ? 'Two-factor authentication is enabled.'
                    : 'Add an extra layer of security to your account.'}
                </p>
              </div>
              {profile?.twoFactorEnabled ? (
                <Badge variant="success">Enabled</Badge>
              ) : (
                <PSButton variant="secondary" size="sm" onClick={handleEnable2FA}>Enable 2FA</PSButton>
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-ps-paper-elevated dark:bg-ps-ink-2 border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Notification preferences coming soon.</CardDescription>
          <div className="mt-4 p-4 rounded-[var(--ps-radius-md)] bg-ps-paper dark:bg-ps-ink-3 text-center">
            <p className="text-sm font-mono text-ps-muted dark:text-ps-muted-on-dark">
              Email and push notification settings will be available in a future update.
            </p>
          </div>
        </Card>

        <Dialog
          open={twoFAOpen && backupCodes.length === 0}
          onClose={() => setTwoFAOpen(false)}
          title="Set Up Two-Factor Authentication"
          actions={
            <>
              <Button variant="ghost" onClick={() => setTwoFAOpen(false)}>Cancel</Button>
              <Button loading={twoFASaving} onClick={handleConfirm2FA}>Verify</Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm">Enter this secret key in your authenticator app:</p>
            <div className="p-3 rounded-[var(--ps-radius-md)] bg-ps-ink-2 text-center">
              <code className="text-sm text-ps-lime font-mono break-all">{twoFASecret}</code>
            </div>
            <p className="text-sm">Then enter the 6-digit code from your app:</p>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoComplete="one-time-code"
            />
          </div>
        </Dialog>

        <Dialog
          open={backupCodes.length > 0}
          onClose={() => { setBackupCodes([]); setTwoFAOpen(false); setTwoFACode(''); setTwoFASecret(''); }}
          title="Save Your Backup Codes"
        >
          <div className="space-y-4">
            <p className="text-sm text-ps-error">
              Save these backup codes in a secure location. Each code can only be used once.
            </p>
            <div className="grid grid-cols-2 gap-2 p-4 rounded-[var(--ps-radius-md)] bg-ps-ink-2">
              {backupCodes.map((code, i) => (
                <code key={i} className="text-sm text-ps-text-on-dark font-mono">{code}</code>
              ))}
            </div>
            <PSButton
              variant="primary"
              fullWidth
              onClick={() => { setBackupCodes([]); setTwoFAOpen(false); setTwoFACode(''); setTwoFASecret(''); }}
            >
              I have saved my backup codes
            </PSButton>
          </div>
        </Dialog>
      </div>
    </FadeIn>
  );
}
