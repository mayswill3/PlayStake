'use client';

import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { KEY_PLAYER_RULES, KEY_REFEREE_RULES } from '@/lib/rules';

type RulesKind = 'player' | 'referee';

const RULES: Record<RulesKind, { items: readonly string[]; href: string; name: string }> = {
  player: { items: KEY_PLAYER_RULES, href: '/match-rules', name: 'Match Rules' },
  referee: { items: KEY_REFEREE_RULES, href: '/match-rules#referees', name: 'Referee Code of Conduct' },
};

/** The key rules as a short list, with a link to the full text. */
export function KeyRules({ kind, className = '' }: { kind: RulesKind; className?: string }) {
  const { items, href, name } = RULES[kind];
  return (
    <div
      className={`rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] p-3 text-xs ${className}`}
    >
      <p className="mb-2 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
        <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
        {name}
      </p>
      <ul className="list-disc space-y-1 pl-4 text-ps-text dark:text-ps-text-on-dark">
        {items.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <Link
        href={href}
        target="_blank"
        className="mt-2 inline-block font-semibold text-ps-text underline underline-offset-2 hover:text-ps-lime dark:text-ps-text-on-dark"
      >
        Read the full {name}
      </Link>
    </div>
  );
}

/** The tick-box that records acceptance. */
export function RulesCheckbox({
  kind,
  checked,
  onChange,
}: {
  kind: RulesKind;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { href, name } = RULES[kind];
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ps-lime)]"
      />
      <span>
        I&apos;ve read and accept the{' '}
        <Link href={href} target="_blank" className="font-semibold underline underline-offset-2">
          {name}
        </Link>
        .
      </span>
    </label>
  );
}

/**
 * Asks for acceptance when the server says the current rules haven't been
 * accepted yet (a 409 with MATCH_RULES_REQUIRED or REFEREE_CODE_REQUIRED).
 */
export function RulesConsentDialog({
  open,
  kind,
  busy,
  acceptLabel,
  onAccept,
  onClose,
}: {
  open: boolean;
  kind: RulesKind;
  busy?: boolean;
  acceptLabel: string;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kind === 'player' ? 'Before your first stream match' : 'Referee Code of Conduct'}
      actions={
        <>
          <PSButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </PSButton>
          <PSButton onClick={onAccept} loading={busy}>
            {acceptLabel}
          </PSButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          {kind === 'player'
            ? 'Stream matches are decided by an independent referee and played under our Match Rules. You only need to accept them once, unless they change.'
            : 'Every referee follows this Code. You only need to accept it once, unless it changes.'}
        </p>
        <KeyRules kind={kind} />
        <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
          By continuing you accept the full {RULES[kind].name}.
        </p>
      </div>
    </Dialog>
  );
}
