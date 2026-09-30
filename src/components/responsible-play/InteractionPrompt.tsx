'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeartHandshake } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { PSButton } from '@/components/ui/playstake/PSButton';

interface Prompt {
  id: string;
  message: string;
}

/** Re-check for new messages this often while the customer is on the site. */
const POLL_MS = 5 * 60 * 1000;

/**
 * Shows the customer any responsible-play message raised about their play,
 * one at a time, until they respond. The response is recorded; choosing a
 * limit or a break takes them straight to where they can set it.
 */
export function InteractionPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/responsible-play/interactions', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { prompts: Prompt[] };
      setPrompt(data.prompts[0] ?? null);
    } catch {
      /* try again on the next poll */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  async function respond(response: 'ok' | 'set_limit' | 'take_break') {
    if (!prompt) return;
    setBusy(true);
    try {
      await fetch(`/api/responsible-play/interactions/${prompt.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
      setPrompt(null);
      if (response !== 'ok') router.push('/responsible-play');
      else void load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={prompt !== null}
      // It stays until they answer, so dismissing counts as "I'm OK".
      onClose={() => void respond('ok')}
      title="A quick check-in"
      actions={
        <div className="flex flex-wrap gap-2">
          <PSButton size="sm" disabled={busy} onClick={() => respond('set_limit')}>
            Set a deposit limit
          </PSButton>
          <PSButton size="sm" variant="secondary" disabled={busy} onClick={() => respond('take_break')}>
            Take a break
          </PSButton>
          <PSButton size="sm" variant="ghost" disabled={busy} onClick={() => respond('ok')}>
            I&apos;m OK, thanks
          </PSButton>
        </div>
      }
    >
      <div className="flex items-start gap-3 text-sm text-fg-secondary">
        <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-lime)]" aria-hidden="true" />
        <p>{prompt?.message}</p>
      </div>
    </Dialog>
  );
}
