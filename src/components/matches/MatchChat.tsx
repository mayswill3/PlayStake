'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, MessageSquare, Scale, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { ChatMessage, ChatRole, ChatRoomState } from '@/lib/matches/chat';

const POLL_MS = 3_000;
const MAX_LENGTH = 280;
/** Cursor overlap so a message committed mid-poll is never skipped; de-duped by id. */
const CURSOR_OVERLAP_MS = 5_000;

/**
 * Spectator chat for one refereed stream match — the same room on /watch and,
 * read-only, on the players' bet page. Polls for new messages (paused while
 * the tab is hidden).
 */
export function MatchChat({ betId, className = '' }: { betId: string; className?: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [room, setRoom] = useState<Pick<ChatRoomState, 'canPost' | 'readOnlyReason' | 'closed' | 'isModerator' | 'viewerId'> | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const merge = useCallback((incoming: ChatMessage[], removedIds: string[] = []) => {
    setMessages((current) => {
      const byId = new Map(current.map((message) => [message.id, message]));
      const fresh = incoming.filter((message) => !byId.has(message.id));
      const gone = removedIds.filter((id) => byId.has(id));
      // Most polls overlap messages we already have — keep the same array so
      // nothing re-renders (and the "new messages" pill doesn't fire).
      if (fresh.length === 0 && gone.length === 0) return current;
      for (const message of fresh) byId.set(message.id, message);
      for (const id of gone) byId.delete(id);
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  const poll = useCallback(async () => {
    const after = cursorRef.current
      ? `?after=${encodeURIComponent(new Date(new Date(cursorRef.current).getTime() - CURSOR_OVERLAP_MS).toISOString())}`
      : '';
    try {
      const response = await fetch(`/api/matches/${betId}/chat${after}`, { cache: 'no-store' });
      if (response.status === 404) {
        setUnavailable(true);
        return;
      }
      if (!response.ok) return;
      const data: ChatRoomState = await response.json();
      cursorRef.current = data.cursor;
      setRoom({
        canPost: data.canPost,
        readOnlyReason: data.readOnlyReason,
        closed: data.closed,
        isModerator: data.isModerator,
        viewerId: data.viewerId,
      });
      merge(data.messages, data.removedIds);
    } catch {
      /* network blip — the next poll retries */
    }
  }, [betId, merge]);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void poll();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  // Follow the conversation only while the reader is already at the bottom.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (pinnedRef.current) list.scrollTop = list.scrollHeight;
    else if (messages.length > 0) setShowJump(true);
  }, [messages]);

  function onScroll() {
    const list = listRef.current;
    if (!list) return;
    pinnedRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    if (pinnedRef.current) setShowJump(false);
  }

  function jumpToLatest() {
    const list = listRef.current;
    if (!list) return;
    pinnedRef.current = true;
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
    setShowJump(false);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const response = await fetch(`/api/matches/${betId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast('error', data.error ?? 'Message not sent');
        return;
      }
      pinnedRef.current = true;
      merge([data.message]);
      setDraft('');
    } catch {
      toast('error', 'Message not sent');
    } finally {
      setSending(false);
    }
  }

  async function remove(messageId: string) {
    const response = await fetch(`/api/matches/${betId}/chat/${messageId}`, { method: 'DELETE' });
    if (response.ok) merge([], [messageId]);
    else toast('error', 'Could not remove that message');
  }

  if (unavailable) return null;

  return (
    <section
      aria-label="Match chat"
      className={`flex min-h-0 flex-col overflow-hidden rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 ${className}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[var(--ps-border-light)] px-4 py-3 dark:border-[var(--ps-border-dark)]">
        <h2 className="flex items-center gap-2 font-display font-semibold text-ps-text dark:text-ps-text-on-dark">
          <MessageSquare className="h-4 w-4 text-ps-lime" aria-hidden="true" />
          Match chat
        </h2>
        {room?.closed ? (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">Closed</span>
        ) : room?.readOnlyReason === 'PLAYER' ? (
          <span className="rounded-full bg-ps-paper px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ps-muted dark:bg-ps-ink-3 dark:text-ps-muted-on-dark">
            View only
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ps-error">
            <span className="h-1.5 w-1.5 rounded-full bg-ps-error animate-pulse" aria-hidden="true" />
            Live
          </span>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={onScroll}
          className="h-full space-y-3 overflow-y-auto px-4 py-3"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {room === null ? (
            <p className="py-10 text-center text-sm text-ps-muted dark:text-ps-muted-on-dark">Loading chat…</p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-ps-muted dark:text-ps-muted-on-dark">
              {room.closed
                ? 'No messages were sent in this match.'
                : room.canPost
                  ? 'No messages yet — start the conversation.'
                  : 'No messages yet.'}
            </p>
          ) : (
            messages.map((message) => (
              <ChatLine
                key={message.id}
                message={message}
                mine={message.author.id === room.viewerId}
                canRemove={room.isModerator}
                onRemove={() => void remove(message.id)}
              />
            ))
          )}
        </div>
        {showJump && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-ps-lime px-3 py-1.5 text-xs font-bold text-ps-ink shadow-lg"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            New messages
          </button>
        )}
      </div>

      <footer className="border-t border-[var(--ps-border-light)] p-3 dark:border-[var(--ps-border-dark)]">
        {room?.canPost ? (
          <form onSubmit={send} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label htmlFor={`chat-${betId}`} className="sr-only">
                Send a message
              </label>
              <input
                id={`chat-${betId}`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_LENGTH}
                placeholder="Send a message"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper px-3 py-2 text-sm text-ps-text outline-none focus:border-ps-lime dark:border-[var(--ps-border-dark)] dark:bg-ps-ink dark:text-ps-text-on-dark"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ps-radius-md)] bg-ps-lime text-ps-ink transition-opacity disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="flex justify-between gap-2 text-[11px] text-ps-muted dark:text-ps-muted-on-dark">
              <span>Be respectful. Never share personal or payment details.</span>
              {draft.length > MAX_LENGTH - 40 && (
                <span className="shrink-0 tabular-nums">{MAX_LENGTH - draft.length}</span>
              )}
            </p>
          </form>
        ) : (
          <p className="py-1 text-center text-xs text-ps-muted dark:text-ps-muted-on-dark">
            {room?.readOnlyReason === 'CLOSED'
              ? 'Chat is closed — this match has ended.'
              : room?.readOnlyReason === 'PLAYER'
                ? 'You’re playing in this match — you can follow the chat, but only spectators can post.'
                : 'Loading…'}
          </p>
        )}
      </footer>
    </section>
  );
}

const ROLE_BADGE: Record<Exclude<ChatRole, 'SPECTATOR'>, { label: string; className: string; icon?: typeof Scale }> = {
  REFEREE: { label: 'Referee', className: 'bg-ps-lime/15 text-ps-lime', icon: Scale },
  PLAYER: { label: 'Player', className: 'bg-ps-cyan/15 text-ps-cyan' },
  STAFF: { label: 'Staff', className: 'bg-ps-warning/15 text-ps-warning', icon: ShieldCheck },
};

function ChatLine({
  message,
  mine,
  canRemove,
  onRemove,
}: {
  message: ChatMessage;
  mine: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const badge = message.author.role === 'SPECTATOR' ? null : ROLE_BADGE[message.author.role];
  const Icon = badge?.icon;
  return (
    <div className={`group rounded-[var(--ps-radius-md)] px-2 py-1 text-sm leading-relaxed ${mine ? 'bg-ps-lime/5' : ''}`}>
      <span className="mr-1.5 inline-flex items-baseline gap-1.5">
        {badge && (
          <span className={`inline-flex items-center gap-0.5 self-center rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wider ${badge.className}`}>
            {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
            {badge.label}
          </span>
        )}
        <span className={`font-semibold ${mine ? 'text-ps-lime' : 'text-ps-text dark:text-ps-text-on-dark'}`}>
          {message.author.displayName}
        </span>
        <time
          dateTime={message.createdAt}
          className="text-[10px] tabular-nums text-ps-muted dark:text-ps-muted-on-dark"
        >
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </span>
      <span className="break-words text-ps-text dark:text-ps-text-on-dark">{message.body}</span>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove message from ${message.author.displayName}`}
          className="ml-2 inline-flex align-middle text-ps-muted opacity-0 transition-opacity hover:text-ps-error focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
