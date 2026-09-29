'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Real-time nudges that someone's live state changed (GET /api/live/stream).
 *
 * One EventSource per tab, shared by every component that uses the hook and
 * closed when the last one unmounts. Events carry no data — `onChange` should
 * refetch whatever the component already polls. Returns whether the stream is
 * connected, so callers can poll slowly while it is and at their normal rate
 * while it isn't (SSE disabled, Redis down, proxy trouble).
 */
export function useLiveStatusEvents(onChange: () => void): boolean {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const isConnected = useSyncExternalStore(
    subscribeConnection,
    () => connected,
    () => false,
  );

  useEffect(() => {
    const listener = () => onChangeRef.current();
    changeListeners.add(listener);
    open();
    return () => {
      changeListeners.delete(listener);
      if (changeListeners.size === 0) close();
    };
  }, []);

  return isConnected;
}

function subscribeConnection(listener: () => void) {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

/** Wait after the server refuses the stream (e.g. 503) before trying again. */
const RETRY_AFTER_REFUSAL_MS = 60_000;
/** Collapse bursts (webhook + worker sync) into one refetch. */
const NOTIFY_DEBOUNCE_MS = 250;

const changeListeners = new Set<() => void>();
const connectionListeners = new Set<() => void>();
let source: EventSource | null = null;
let connected = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let notifyTimer: ReturnType<typeof setTimeout> | undefined;

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  for (const listener of connectionListeners) listener();
}

function notify() {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    for (const listener of changeListeners) listener();
  }, NOTIFY_DEBOUNCE_MS);
}

function open() {
  if (source || retryTimer || typeof EventSource === 'undefined') return;
  const es = new EventSource('/api/live/stream');
  source = es;
  let openedBefore = false;

  es.onopen = () => {
    // Events may have been missed while reconnecting — catch up once.
    if (openedBefore) notify();
    openedBefore = true;
    setConnected(true);
  };
  es.onmessage = () => notify();
  es.onerror = () => {
    setConnected(false);
    // CONNECTING: a dropped connection the browser is already retrying.
    // CLOSED: the server refused it (disabled, signed out), which browsers
    // never retry on their own — back off and try again later.
    if (es.readyState !== EventSource.CLOSED) return;
    es.close();
    source = null;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      if (changeListeners.size > 0) open();
    }, RETRY_AFTER_REFUSAL_MS);
  };
}

function close() {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  clearTimeout(notifyTimer);
  source?.close();
  source = null;
  setConnected(false);
}
