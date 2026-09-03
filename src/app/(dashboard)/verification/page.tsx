'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

type KycStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
type DocumentType = 'PASSPORT' | 'DRIVERS_LICENCE' | 'NATIONAL_ID';

interface KycState {
  kycStatus: KycStatus;
  emailVerified: boolean;
  canSubmit: boolean;
  submission: null | {
    id: string;
    status: string;
    documentType: DocumentType;
    reviewNotes: string | null;
    reviewedAt: string | null;
    createdAt: string;
    documents: string[];
  };
}

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string; needsBack: boolean }> = [
  { value: 'PASSPORT', label: 'Passport', needsBack: false },
  { value: 'DRIVERS_LICENCE', label: "Driver's licence", needsBack: true },
  { value: 'NATIONAL_ID', label: 'National ID card', needsBack: true },
];

const STATUS_PILL: Record<KycStatus, { status: 'waiting' | 'completed' | 'disputed' | 'expired'; label: string }> = {
  NOT_STARTED: { status: 'expired', label: 'NOT STARTED' },
  PENDING: { status: 'waiting', label: 'UNDER REVIEW' },
  VERIFIED: { status: 'completed', label: 'VERIFIED' },
  REJECTED: { status: 'disputed', label: 'DECLINED' },
};

function FileField({
  name,
  label,
  hint,
  required,
}: {
  name: string;
  label: string;
  hint: string;
  required?: boolean;
}) {
  return (
    <div className="w-full">
      <label
        htmlFor={name}
        className="block text-[11px] font-semibold uppercase tracking-wider text-fg-secondary mb-1.5"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        required={required}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 text-sm text-fg file:mr-3 file:rounded-md file:border-0 file:bg-[var(--ps-lime)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-black"
      />
      <p className="mt-1 text-xs text-fg-secondary">{hint}</p>
    </div>
  );
}

export default function VerificationPage() {
  const { toast } = useToast();
  const [state, setState] = useState<KycState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('PASSPORT');
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    const response = await fetch('/api/kyc', { cache: 'no-store' });
    if (response.ok) setState((await response.json()) as KycState);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/kyc', { method: 'POST', body: form });
      const data = await response.json();

      if (!response.ok) {
        setErrors((data.details as Record<string, string[]>) ?? {});
        toast('error', data.error ?? 'Could not submit your documents.');
        return;
      }

      toast('success', 'Documents submitted. We will email you once reviewed.');
      await load();
    } catch {
      toast('error', 'Could not submit your documents. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!state) return null;

  const pill = STATUS_PILL[state.kycStatus];
  const needsBack = DOCUMENT_TYPES.find((type) => type.value === documentType)?.needsBack ?? false;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Identity verification</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            Required before you can deposit, withdraw, or stake real money.
          </p>
        </div>
        <StatusPill status={pill.status} label={pill.label} />
      </div>

      {state.kycStatus === 'VERIFIED' && (
        <Card className="border-l-4 border-l-[var(--ps-success)]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-success)]" />
            <div>
              <CardTitle>You are verified</CardTitle>
              <p className="mt-1 text-sm text-fg-secondary">
                Deposits and withdrawals are unlocked.{' '}
                <Link href="/wallet" className="underline">
                  Go to your wallet
                </Link>
                .
              </p>
            </div>
          </div>
        </Card>
      )}

      {state.kycStatus === 'PENDING' && (
        <Card className="border-l-4 border-l-[var(--ps-warning)]">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-warning)]" />
            <div>
              <CardTitle>Under review</CardTitle>
              <p className="mt-1 text-sm text-fg-secondary">
                A reviewer is checking the documents you submitted on{' '}
                {state.submission
                  ? new Date(state.submission.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'file'}
                . We will email you as soon as there is a decision — usually within one business day.
              </p>
            </div>
          </div>
        </Card>
      )}

      {state.kycStatus === 'REJECTED' && (
        <Card className="border-l-4 border-l-[var(--ps-error)]">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-error)]" />
            <div>
              <CardTitle>We could not verify your documents</CardTitle>
              {state.submission?.reviewNotes && (
                <p className="mt-1 text-sm text-fg-secondary">
                  Reviewer notes: {state.submission.reviewNotes}
                </p>
              )}
              <p className="mt-1 text-sm text-fg-secondary">
                Submit clear, uncropped photos below to try again.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!state.emailVerified && (
        <Card className="border-l-4 border-l-[var(--ps-warning)]">
          <CardTitle>Verify your email first</CardTitle>
          <p className="mt-1 text-sm text-fg-secondary">
            Confirm your email address before submitting identity documents.
          </p>
        </Card>
      )}

      {state.canSubmit && (
        <Card>
          <div className="mb-5 flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-lime)]" />
            <div>
              <CardTitle>Submit your documents</CardTitle>
              <p className="mt-1 text-sm text-fg-secondary">
                Your details must match your ID exactly. Documents are encrypted and only
                visible to our review team.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="legalFirstName"
                label="Legal first name"
                required
                maxLength={100}
                error={errors.legalFirstName?.[0]}
              />
              <Input
                name="legalLastName"
                label="Legal last name"
                required
                maxLength={100}
                error={errors.legalLastName?.[0]}
              />
            </div>

            <Input
              name="dateOfBirth"
              type="date"
              label="Date of birth"
              required
              error={errors.dateOfBirth?.[0]}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="addressLine1"
                label="Address line 1"
                required
                maxLength={200}
                error={errors.addressLine1?.[0]}
              />
              <Input name="addressLine2" label="Address line 2 (optional)" maxLength={200} />
              <Input name="city" label="City" required maxLength={100} error={errors.city?.[0]} />
              <Input name="region" label="State / region (optional)" maxLength={100} />
              <Input
                name="postalCode"
                label="Postal code"
                required
                maxLength={20}
                error={errors.postalCode?.[0]}
              />
              <Input
                name="country"
                label="Country code (e.g. GB)"
                required
                maxLength={2}
                placeholder="GB"
                error={errors.country?.[0]}
              />
            </div>

            <div>
              <label
                htmlFor="documentType"
                className="block text-[11px] font-semibold uppercase tracking-wider text-fg-secondary mb-1.5"
              >
                Document type
              </label>
              <select
                id="documentType"
                name="documentType"
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value as DocumentType)}
                className="block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 text-sm text-fg"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FileField
                name="documentFront"
                label={needsBack ? 'Document — front' : 'Photo page'}
                hint="JPEG, PNG, WebP or PDF. Max 8MB."
                required
              />
              {needsBack && (
                <FileField
                  name="documentBack"
                  label="Document — back"
                  hint="JPEG, PNG, WebP or PDF. Max 8MB."
                  required
                />
              )}
              <FileField
                name="selfie"
                label="Selfie holding your document"
                hint="Your face and the document must both be readable."
                required
              />
            </div>

            <PSButton type="submit" loading={submitting} icon={<Upload size={16} />} fullWidth>
              Submit for review
            </PSButton>
          </form>
        </Card>
      )}
    </div>
  );
}
