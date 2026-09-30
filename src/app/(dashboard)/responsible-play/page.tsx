'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, ShieldCheck, TrendingDown } from 'lucide-react';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatCents } from '@/lib/utils/format';

type Period = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type BreakType = 'COOL_OFF' | 'SELF_EXCLUSION';

interface Limit {
  period: Period;
  amountCents: number;
  pendingAmountCents: number | null;
  pendingEffectiveAt: string | null;
  pendingRemoval: boolean;
  usedCents: number;
  remainingCents: number;
}

interface BreakOption {
  id: string;
  label: string;
  durationMs: number;
}

interface State {
  limits: Limit[];
  activeBreak: null | {
    type: BreakType;
    startsAt: string;
    endsAt: string;
    /** A self-exclusion whose period has ended; the customer hasn't returned yet. */
    awaitingReturn: boolean;
    returnEffectiveAt: string | null;
  };
  sessionReminderMinutes: number | null;
  options: {
    breaks: Record<BreakType, BreakOption[]>;
    periodLabels: Record<Period, string>;
    reminderIntervals: number[];
  };
}

const PERIODS: Period[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

const PERIOD_TITLE: Record<Period, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ResponsiblePlayPage() {
  const { toast } = useToast();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<Period, string>>({
    DAILY: '',
    WEEKLY: '',
    MONTHLY: '',
  });
  const [busy, setBusy] = useState(false);
  const [breakDraft, setBreakDraft] = useState<{
    type: BreakType;
    option: BreakOption;
  } | null>(null);
  const [confirmingReturn, setConfirmingReturn] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/responsible-play', { cache: 'no-store' });
      if (response.ok) setState((await response.json()) as State);
    } catch {
      // Network failure: leave whatever is on screen rather than rejecting
      // into an unhandled promise, which reports as an error and would have
      // left this page on its spinner.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLimit(period: Period) {
    const raw = drafts[period].trim();
    const dollars = Number(raw);
    if (!raw || !Number.isFinite(dollars) || dollars <= 0) {
      toast('error', 'Enter an amount greater than zero.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/responsible-play/deposit-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, amount: Math.round(dollars * 100) }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast('error', data.error ?? 'Could not save that limit.');
        return;
      }

      toast(
        'success',
        data.effectiveNow
          ? 'Limit updated. It applies immediately.'
          : `Increase scheduled for ${formatDateTime(data.effectiveAt)}. Your current limit stays in force until then.`,
      );
      setDrafts((prev) => ({ ...prev, [period]: '' }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeLimit(period: Period, scope: 'pending' | 'limit') {
    setBusy(true);
    try {
      const response = await fetch('/api/responsible-play/deposit-limits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, scope }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast('error', data.error ?? 'Could not update that limit.');
        return;
      }
      toast(
        'success',
        scope === 'pending'
          ? 'Pending change cancelled.'
          : data.effectiveAt
            ? `Your limit will be removed on ${formatDateTime(data.effectiveAt)}. It stays in force until then.`
            : 'Limit removed.',
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function confirmBreak() {
    if (!breakDraft) return;
    setBusy(true);
    try {
      const response = await fetch('/api/responsible-play/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: breakDraft.type,
          optionId: breakDraft.option.id,
          acknowledged: true,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast('error', data.error ?? 'Could not start that break.');
        return;
      }

      setBreakDraft(null);
      toast('success', 'Your break has started.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function requestReturn() {
    setBusy(true);
    try {
      const response = await fetch('/api/responsible-play/break/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast('error', data.error ?? 'Could not process that request.');
        return;
      }
      setConfirmingReturn(false);
      toast('success', `Your account reopens on ${formatDateTime(data.returnEffectiveAt)}.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveReminder(minutes: number | null) {
    setBusy(true);
    try {
      const response = await fetch('/api/responsible-play', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
      if (!response.ok) {
        toast('error', 'Could not save that setting.');
        return;
      }
      toast('success', minutes ? `Reminder set for every ${minutes} minutes.` : 'Reminders turned off.');
      await load();
    } finally {
      setBusy(false);
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

  const limitFor = (period: Period) =>
    state.limits.find((limit) => limit.period === period);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Responsible play</h1>
        <p className="mt-1 text-sm text-fg-secondary">
          Set your own limits, take a break, and get reminders while you play.
        </p>
      </div>

      {state.activeBreak && (
        <Card className="border-l-4 border-l-[var(--ps-warning)]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-warning)]" />
            <div>
              <CardTitle>
                {state.activeBreak.type === 'COOL_OFF'
                  ? 'You are on a cool-off break'
                  : state.activeBreak.awaitingReturn
                    ? 'Your self-exclusion period has ended'
                    : 'You are self-excluded'}
              </CardTitle>
              {state.activeBreak.returnEffectiveAt ? (
                <p className="mt-1 text-sm text-fg-secondary">
                  You asked to return. Deposits and betting reopen on{' '}
                  <strong>{formatDateTime(state.activeBreak.returnEffectiveAt)}</strong>, after a
                  24-hour cooling-off period.
                </p>
              ) : state.activeBreak.awaitingReturn ? (
                <>
                  <p className="mt-1 text-sm text-fg-secondary">
                    Your account stays closed to gambling until you choose to come back. If you
                    ask to return, deposits and betting reopen 24 hours later. You can still
                    withdraw your balance.
                  </p>
                  <PSButton
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    disabled={busy}
                    onClick={() => setConfirmingReturn(true)}
                  >
                    Return to PlayStake
                  </PSButton>
                </>
              ) : (
                <p className="mt-1 text-sm text-fg-secondary">
                  Deposits and betting are blocked until{' '}
                  <strong>{formatDateTime(state.activeBreak.endsAt)}</strong>. You can still
                  withdraw your balance. This cannot be lifted early.
                  {state.activeBreak.type === 'SELF_EXCLUSION' &&
                    ' When it ends, your account stays closed until you ask to return.'}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Deposit limits */}
      <Card>
        <div className="mb-5 flex items-start gap-3">
          <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-lime)]" />
          <div>
            <CardTitle>Deposit limits</CardTitle>
            <CardDescription>
              Caps how much you can deposit in a rolling period. Lowering a limit
              applies straight away; raising or removing one takes 24 hours.
            </CardDescription>
          </div>
        </div>

        <div className="space-y-5">
          {PERIODS.map((period) => {
            const limit = limitFor(period);
            return (
              <div
                key={period}
                className="rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-fg">
                    {PERIOD_TITLE[period]}
                    <span className="ml-2 text-xs font-normal text-fg-secondary">
                      rolling {state.options.periodLabels[period]}
                    </span>
                  </h3>
                  {limit ? (
                    <p className="font-mono text-sm tabular-nums">
                      {formatCents(limit.usedCents)} of {formatCents(limit.amountCents)} used
                    </p>
                  ) : (
                    <p className="text-sm text-fg-secondary">No limit set</p>
                  )}
                </div>

                {limit && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ps-border-light)] dark:bg-[var(--ps-border-dark)]">
                    <div
                      className="h-full rounded-full bg-[var(--ps-lime)]"
                      style={{
                        width: `${Math.min(100, limit.amountCents > 0 ? (limit.usedCents / limit.amountCents) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                )}

                {limit?.pendingRemoval && limit.pendingEffectiveAt && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <p className="text-[var(--ps-warning)]">
                      This limit will be removed {formatDateTime(limit.pendingEffectiveAt)}.
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLimit(period, 'pending')}
                      disabled={busy}
                      className="underline text-fg-secondary"
                    >
                      Keep my limit
                    </button>
                  </div>
                )}

                {limit?.pendingAmountCents && limit.pendingEffectiveAt && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <p className="text-[var(--ps-warning)]">
                      Increase to {formatCents(limit.pendingAmountCents)} takes effect{' '}
                      {formatDateTime(limit.pendingEffectiveAt)}.
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLimit(period, 'pending')}
                      disabled={busy}
                      className="underline text-fg-secondary"
                    >
                      Cancel it
                    </button>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="min-w-[160px] flex-1">
                    <Input
                      label={limit ? 'Change limit' : 'Set limit'}
                      inputMode="decimal"
                      prefix="$"
                      placeholder="100.00"
                      value={drafts[period]}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [period]: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <PSButton size="sm" onClick={() => saveLimit(period)} loading={busy}>
                    Save
                  </PSButton>
                  {limit && !limit.pendingRemoval && (
                    <PSButton
                      size="sm"
                      variant="ghost"
                      onClick={() => removeLimit(period, 'limit')}
                      disabled={busy}
                    >
                      Remove
                    </PSButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Breaks */}
      <Card>
        <div className="mb-5 flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-lime)]" />
          <div>
            <CardTitle>Take a break</CardTitle>
            <CardDescription>
              Blocks deposits and betting for a fixed period. You can still withdraw
              your balance. A break cannot be shortened or lifted early.
            </CardDescription>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-fg">Cool-off</h3>
            <p className="mb-2 text-sm text-fg-secondary">
              A short break to step away.
            </p>
            <div className="flex flex-wrap gap-2">
              {state.options.breaks.COOL_OFF.map((option) => (
                <PSButton
                  key={option.id}
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setBreakDraft({ type: 'COOL_OFF', option })}
                >
                  {option.label}
                </PSButton>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-fg">Self-exclusion</h3>
            <p className="mb-2 text-sm text-fg-secondary">
              A long-term block for when betting has stopped being fun. When it ends, your
              account stays closed until you ask to return.
            </p>
            <div className="flex flex-wrap gap-2">
              {state.options.breaks.SELF_EXCLUSION.map((option) => (
                <PSButton
                  key={option.id}
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => setBreakDraft({ type: 'SELF_EXCLUSION', option })}
                >
                  {option.label}
                </PSButton>
              ))}
            </div>
            <p className="mt-3 text-xs text-fg-secondary">
              To block yourself from every UK-licensed gambling site at once, register free
              with{' '}
              <a href="https://www.gamstop.co.uk" target="_blank" rel="noreferrer" className="underline">
                GAMSTOP
              </a>
              . For free, confidential support, contact{' '}
              <a href="https://www.gamcare.org.uk" target="_blank" rel="noreferrer" className="underline">
                GamCare
              </a>{' '}
              on 0808 8020 133 or visit{' '}
              <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer" className="underline">
                BeGambleAware
              </a>
              .
            </p>
          </div>
        </div>
      </Card>

      {/* Session reminders */}
      <Card>
        <div className="mb-5 flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-lime)]" />
          <div>
            <CardTitle>Session reminders</CardTitle>
            <CardDescription>
              A periodic prompt showing how long you have been playing and how you
              are doing.
            </CardDescription>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {state.options.reminderIntervals.map((minutes) => (
            <PSButton
              key={minutes}
              size="sm"
              variant={state.sessionReminderMinutes === minutes ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => saveReminder(minutes)}
            >
              Every {minutes} min
            </PSButton>
          ))}
          <PSButton
            size="sm"
            variant={state.sessionReminderMinutes === null ? 'primary' : 'ghost'}
            disabled={busy}
            onClick={() => saveReminder(null)}
          >
            Off
          </PSButton>
        </div>
      </Card>

      <Dialog
        open={breakDraft !== null}
        onClose={() => setBreakDraft(null)}
        title={
          breakDraft?.type === 'SELF_EXCLUSION'
            ? `Self-exclude for ${breakDraft.option.label}?`
            : `Cool off for ${breakDraft?.option.label}?`
        }
        actions={
          <div className="flex flex-wrap gap-3">
            <PSButton variant="danger" onClick={confirmBreak} loading={busy}>
              Yes, start my break
            </PSButton>
            <PSButton variant="ghost" onClick={() => setBreakDraft(null)}>
              Cancel
            </PSButton>
          </div>
        }
      >
        <div className="space-y-2 text-sm text-fg-secondary">
          <p>
            Deposits and betting will be blocked for{' '}
            <strong className="text-fg">{breakDraft?.option.label}</strong>.
          </p>
          <p>
            <strong className="text-fg">This cannot be undone.</strong> Support
            cannot shorten or lift it early, so please be sure before you confirm.
          </p>
          <p>
            You will still be able to sign in and withdraw your balance. Bets already
            in play will settle as normal; anything you are waiting on in a lobby, and
            challenges you have sent or received, will be withdrawn.
          </p>
          {breakDraft?.type === 'SELF_EXCLUSION' && (
            <p>
              When the period ends your account stays closed to gambling until you ask to
              return, and then reopens 24 hours later.
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={confirmingReturn}
        onClose={() => setConfirmingReturn(false)}
        title="Return to PlayStake?"
        actions={
          <div className="flex flex-wrap gap-3">
            <PSButton onClick={requestReturn} loading={busy}>
              Yes, reopen my account
            </PSButton>
            <PSButton variant="ghost" onClick={() => setConfirmingReturn(false)}>
              Stay excluded
            </PSButton>
          </div>
        }
      >
        <div className="space-y-2 text-sm text-fg-secondary">
          <p>
            Your account will reopen for deposits and betting <strong className="text-fg">24 hours</strong>{' '}
            after you confirm. You can set deposit limits before then.
          </p>
          <p>
            If you are not sure, it is fine to stay excluded. Free, confidential support is
            available from GamCare on 0808 8020 133.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
