'use client';

import { useEffect, useState, type FormEvent } from 'react';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'ACCOUNT', label: 'My account' },
  { value: 'PAYMENTS', label: 'A deposit or payment' },
  { value: 'WITHDRAWALS', label: 'A withdrawal' },
  { value: 'BET_OR_RESULT', label: 'A bet or its result' },
  { value: 'REFEREE', label: 'A referee' },
  { value: 'RESPONSIBLE_GAMBLING', label: 'Limits, breaks or self-exclusion' },
  { value: 'TECHNICAL', label: 'Something not working' },
  { value: 'OTHER', label: 'Something else' },
];

interface MyComplaint {
  id: string;
  reference: string;
  status: string;
  receivedAt: string;
  finalResponseDueAt: string;
  finalResponseAt: string | null;
  outcome: string | null;
}

const fieldClass =
  'w-full rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper px-3 py-2 text-sm text-ps-text focus:outline-none focus:ring-2 focus:ring-ps-lime/60 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-text-on-dark';

function day(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ComplaintForm() {
  const [signedIn, setSignedIn] = useState(false);
  const [mine, setMine] = useState<MyComplaint[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filed, setFiled] = useState<{ reference: string; finalResponseDueAt: string } | null>(null);

  useEffect(() => {
    fetch('/api/complaints', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setSignedIn(true);
        setMine(data.complaints ?? []);
      })
      .catch(() => {});
  }, [filed]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description,
          ...(signedIn ? {} : { name, email }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? 'We could not send your complaint. Please email support@playstake.org.');
        return;
      }
      setFiled(data);
      setDescription('');
      setCategory('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {filed && (
        <div role="status" className="rounded-[var(--ps-radius-md)] border border-ps-lime/40 bg-ps-lime/10 p-4 text-sm">
          <p className="font-semibold text-ps-text dark:text-ps-text-on-dark">
            Complaint received — your reference is {filed.reference}
          </p>
          <p className="mt-1 text-ps-muted dark:text-ps-muted-on-dark">
            We have emailed you a copy. You will have our final response by{' '}
            {day(filed.finalResponseDueAt)} at the latest.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 not-prose">
        {!signedIn && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Your name</span>
              <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Email address</span>
              <input className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
          </div>
        )}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">What is it about?</span>
          <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="" disabled>
              Choose one
            </option>
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">What happened, and what would you like us to do?</span>
          <textarea
            className={`${fieldClass} min-h-[140px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={20}
            maxLength={5000}
          />
        </label>
        {error && <p role="alert" className="text-sm text-ps-error">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-[var(--ps-radius-md)] bg-ps-lime px-5 py-2.5 text-sm font-bold text-ps-ink disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send complaint'}
        </button>
      </form>

      {mine.length > 0 && (
        <div className="not-prose">
          <h3 className="mb-2 text-sm font-semibold">Your complaints</h3>
          <ul className="divide-y divide-[var(--ps-border-light)] text-sm dark:divide-[var(--ps-border-dark)]">
            {mine.map((complaint) => (
              <li key={complaint.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-mono">{complaint.reference}</span>
                <span className="text-ps-muted dark:text-ps-muted-on-dark">
                  {complaint.finalResponseAt
                    ? `Final response ${day(complaint.finalResponseAt)} · ${complaint.outcome?.replace(/_/g, ' ').toLowerCase()}`
                    : `Open · response due by ${day(complaint.finalResponseDueAt)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
