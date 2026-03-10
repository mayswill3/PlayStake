'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils/format';

interface ApiKey {
  id: string;
  keyPrefix: string;
  label: string;
  permissions: string[];
  lastUsedAt: string | null;
  status: string;
  createdAt: string;
}

const PERMISSION_OPTIONS = [
  { value: 'bet:create', label: 'Create Bets' },
  { value: 'bet:read', label: 'Read Bets' },
  { value: 'result:report', label: 'Report Results' },
  { value: 'widget:auth', label: 'Widget Auth' },
  { value: 'webhook:manage', label: 'Manage Webhooks' },
];

export default function ApiKeysPage() {
  const { toast } = useToast();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['bet:create', 'bet:read', 'result:report']);
  const [creating, setCreating] = useState(false);

  // Show key modal
  const [newKeyRaw, setNewKeyRaw] = useState('');
  const [showKeyOpen, setShowKeyOpen] = useState(false);

  // Revoke confirmation
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  function fetchKeys() {
    fetch('/api/developer/api-keys')
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load API keys');
        return r.json();
      })
      .then((data) => setKeys(data.data || data))
      .catch(() => setError('Failed to load API keys.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  function togglePermission(perm: string) {
    setPermissions((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm]
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || permissions.length === 0) return;
    setCreating(true);

    try {
      const res = await fetch('/api/developer/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, permissions }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast('error', data.error || 'Failed to create API key.');
        setCreating(false);
        return;
      }

      setNewKeyRaw(data.key);
      setShowKeyOpen(true);
      setCreateOpen(false);
      setLabel('');
      setPermissions(['bet:create', 'bet:read', 'result:report']);
      fetchKeys();
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeId) return;
    setRevoking(true);

    try {
      const res = await fetch(`/api/developer/api-keys/${revokeId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        toast('error', 'Failed to revoke API key.');
      } else {
        toast('success', 'API key revoked.');
        fetchKeys();
      }
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setRevoking(false);
      setRevokeId(null);
    }
  }

  async function handleCopyKey() {
    try {
      await navigator.clipboard.writeText(newKeyRaw);
      toast('success', 'API key copied to clipboard.');
    } catch {
      // Fallback: select all in the code block
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100">API Keys</h1>
        <Button onClick={() => setCreateOpen(true)}>Generate New Key</Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm">
          {error}
        </div>
      )}

      {keys.length === 0 ? (
        <Card>
          <EmptyState
            title="No API keys"
            description="Generate an API key to start making requests to the PlayStake Developer API."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>Generate Key</Button>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-surface-400 border-b border-surface-800">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Key Prefix</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3">Last Used</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-surface-800/50 transition-colors">
                    <td className="px-4 py-3 text-surface-200 font-medium">{key.label}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-surface-400 font-mono bg-surface-800 px-2 py-1 rounded">
                        {key.keyPrefix}...
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.map((p) => (
                          <span key={p} className="text-xs bg-surface-800 text-surface-400 px-1.5 py-0.5 rounded">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-surface-400 text-xs">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={key.status || 'ACTIVE'} />
                    </td>
                    <td className="px-4 py-3">
                      {(key.status || 'ACTIVE') !== 'REVOKED' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRevokeId(key.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create key dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Generate New API Key"
        actions={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={creating} onClick={handleCreate as any}>Generate</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Production Server"
            required
          />
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Permissions</label>
            <div className="space-y-2">
              {PERMISSION_OPTIONS.map((perm) => (
                <label key={perm.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.value)}
                    onChange={() => togglePermission(perm.value)}
                    className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-sm text-surface-300">{perm.label}</span>
                  <span className="text-xs text-surface-500 font-mono">{perm.value}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Dialog>

      {/* Show new key dialog */}
      <Dialog
        open={showKeyOpen}
        onClose={() => { setShowKeyOpen(false); setNewKeyRaw(''); }}
        title="API Key Generated"
      >
        <div className="space-y-4">
          <p className="text-sm text-danger-300">
            Copy this key now. You will not be able to see it again.
          </p>
          <div className="p-3 rounded-lg bg-surface-800 break-all">
            <code className="text-sm text-brand-400 font-mono">{newKeyRaw}</code>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleCopyKey} className="flex-1">
              Copy to Clipboard
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setShowKeyOpen(false); setNewKeyRaw(''); }}
            >
              Done
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog
        open={!!revokeId}
        onClose={() => setRevokeId(null)}
        title="Revoke API Key"
        actions={
          <>
            <Button variant="ghost" onClick={() => setRevokeId(null)}>Cancel</Button>
            <Button variant="danger" loading={revoking} onClick={handleRevoke}>
              Revoke Key
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Are you sure you want to revoke this API key? This action cannot be undone.
          Any services using this key will immediately lose access.
        </p>
      </Dialog>
    </div>
  );
}
