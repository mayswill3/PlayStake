'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

const OPTIONS: Array<{ value: string; label: (a: string, b: string) => string }> = [
  { value: 'RESOLVED_PLAYER_A', label: (a) => `${a} won` },
  { value: 'RESOLVED_PLAYER_B', label: (_a, b) => `${b} won` },
  { value: 'RESOLVED_DRAW', label: () => 'Draw (stakes returned less the fee)' },
  { value: 'RESOLVED_VOID', label: () => 'Void the match (both stakes refunded in full)' },
];

/** Uphold or change the result, with written reasons the players are told. */
export function DisputeDecisionForm({
  playerA,
  playerB,
  busy,
  onDecide,
}: {
  playerA: string;
  playerB: string;
  busy: boolean;
  onDecide: (status: string, resolution: string) => void;
}) {
  const [status, setStatus] = useState('');
  const [reasons, setReasons] = useState('');
  const ready = status && reasons.trim().length >= 10;
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-fg">Your decision</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm text-fg">
            <input
              type="radio"
              name="decision"
              value={option.value}
              checked={status === option.value}
              onChange={() => setStatus(option.value)}
              className="accent-[var(--ps-lime)]"
            />
            {option.label(playerA, playerB)}
          </label>
        ))}
      </fieldset>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-fg">Reasons (the players see these)</span>
        <textarea
          value={reasons}
          onChange={(e) => setReasons(e.target.value)}
          rows={4}
          placeholder="What you saw on the streams and why it decides the result. At least 10 characters."
          className="w-full rounded-lg border border-[var(--border)] bg-transparent p-3 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--ps-lime)]"
        />
      </label>
      <Button disabled={!ready} loading={busy} onClick={() => onDecide(status, reasons.trim())}>
        Record decision
      </Button>
    </div>
  );
}
