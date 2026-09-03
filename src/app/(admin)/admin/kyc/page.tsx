'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface SubmissionRow {
  id: string;
  status: SubmissionStatus;
  legalFirstName: string;
  legalLastName: string;
  country: string;
  documentType: string;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; email: string; displayName: string };
}

interface SubmissionDetail extends SubmissionRow {
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  reviewNotes: string | null;
  reviewedBy: { id: string; displayName: string; email: string } | null;
  documents: Array<{ id: string; kind: string; mimeType: string; byteSize: number }>;
}

interface ListResponse {
  data: SubmissionRow[];
  pendingTotal: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return 'success' as const;
    case 'REJECTED':
      return 'danger' as const;
    case 'PENDING':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
};

const DOCUMENT_LABELS: Record<string, string> = {
  DOCUMENT_FRONT: 'Document — front',
  DOCUMENT_BACK: 'Document — back',
  SELFIE: 'Selfie with document',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminKycPage() {
  const { toast } = useToast();
  const [response, setResponse] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SubmissionStatus | ''>('PENDING');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SubmissionDetail | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());

    const result = await fetch(`/api/admin/kyc?${params}`, { cache: 'no-store' });
    if (result.ok) setResponse((await result.json()) as ListResponse);
    setLoading(false);
  }, [page, status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openSubmission(id: string) {
    setReviewNotes('');
    const result = await fetch(`/api/admin/kyc/${id}`, { cache: 'no-store' });
    if (!result.ok) {
      toast('error', 'Could not load that submission.');
      return;
    }
    setSelected((await result.json()) as SubmissionDetail);
  }

  async function review(decision: 'APPROVE' | 'REJECT') {
    if (!selected) return;
    if (decision === 'REJECT' && !reviewNotes.trim()) {
      toast('error', 'A rejection needs a reason — the player is shown these notes.');
      return;
    }

    setBusy(true);
    try {
      const result = await fetch(`/api/admin/kyc/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewNotes: reviewNotes.trim() || undefined }),
      });
      const data = await result.json();

      if (!result.ok) {
        toast('error', data.error ?? 'Could not record that decision.');
        return;
      }

      toast('success', decision === 'APPROVE' ? 'Submission approved.' : 'Submission rejected.');
      setSelected(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">KYC review</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            {response ? `${response.pendingTotal} awaiting review` : 'Loading queue…'}
          </p>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              label="Search"
              placeholder="Name or email"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </div>
          <div>
            <label
              htmlFor="statusFilter"
              className="block text-[11px] font-semibold uppercase tracking-wider text-fg-secondary mb-1.5"
            >
              Status
            </label>
            <select
              id="statusFilter"
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as SubmissionStatus | '');
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 text-sm text-fg"
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : !response || response.data.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-10 w-10" />}
          title="Nothing to review"
          description="Verification packets appear here as players submit them."
        />
      ) : (
        <FadeIn>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Player</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Legal name</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Document</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Submitted</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {response.data.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-fg">{row.user.displayName}</div>
                      <div className="text-xs text-fg-secondary">{row.user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.legalFirstName} {row.legalLastName}
                      <div className="text-xs text-fg-secondary">{row.country}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{row.documentType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PSButton size="sm" variant="secondary" onClick={() => openSubmission(row.id)}>
                        Review
                      </PSButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {response.pagination.totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                page={response.pagination.page}
                totalPages={response.pagination.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </FadeIn>
      )}

      {selected && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                {selected.legalFirstName} {selected.legalLastName}
              </CardTitle>
              <p className="mt-1 text-sm text-fg-secondary">
                {selected.user.displayName} · {selected.user.email}
              </p>
            </div>
            <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-fg-secondary">Date of birth</dt>
              <dd className="text-fg">{formatDate(selected.dateOfBirth)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-fg-secondary">Document type</dt>
              <dd className="text-fg">{selected.documentType.replace(/_/g, ' ')}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-fg-secondary">Address</dt>
              <dd className="text-fg">
                {[
                  selected.addressLine1,
                  selected.addressLine2,
                  selected.city,
                  selected.region,
                  selected.postalCode,
                  selected.country,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </dd>
            </div>
          </dl>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {selected.documents.map((document) => {
              const href = `/api/admin/kyc/${selected.id}/documents/${document.id}`;
              return (
                <div key={document.id}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">
                    {DOCUMENT_LABELS[document.kind] ?? document.kind}
                  </p>
                  {document.mimeType === 'application/pdf' ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-[var(--border)] p-4 text-sm underline"
                    >
                      Open PDF ({Math.ceil(document.byteSize / 1024)}KB)
                    </a>
                  ) : (
                    <a href={href} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={href}
                        alt={DOCUMENT_LABELS[document.kind] ?? document.kind}
                        className="w-full rounded-lg border border-[var(--border)] object-contain"
                      />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {selected.status === 'PENDING' ? (
            <div className="mt-6 space-y-3">
              <Input
                label="Reviewer notes (required to reject — shown to the player)"
                value={reviewNotes}
                maxLength={1000}
                onChange={(event) => setReviewNotes(event.target.value)}
                placeholder="e.g. Document photo is cut off at the edges"
              />
              <div className="flex flex-wrap gap-3">
                <PSButton onClick={() => review('APPROVE')} loading={busy}>
                  Approve
                </PSButton>
                <PSButton variant="danger" onClick={() => review('REJECT')} loading={busy}>
                  Reject
                </PSButton>
                <PSButton variant="ghost" onClick={() => setSelected(null)}>
                  Close
                </PSButton>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-2 text-sm text-fg-secondary">
              <p>
                {selected.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                {selected.reviewedAt ? ` on ${formatDate(selected.reviewedAt)}` : ''}
                {selected.reviewedBy ? ` by ${selected.reviewedBy.displayName}` : ''}.
              </p>
              {selected.reviewNotes && <p>Notes: {selected.reviewNotes}</p>}
              <PSButton variant="ghost" onClick={() => setSelected(null)}>
                Close
              </PSButton>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
