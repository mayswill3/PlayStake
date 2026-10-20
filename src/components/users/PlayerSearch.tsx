'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

interface Result {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isStreamer: boolean;
  isLive: boolean;
}

const MIN_LENGTH = 2;

/**
 * "Find players" box in the header. Searches streamers and players who have
 * chosen to be findable, as you type, and opens their profile.
 */
export function PlayerSearch() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Phones show an icon until tapped.
  const [expanded, setExpanded] = useState(false);

  const trimmed = query.trim().replace(/^@/, '');

  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { results: Result[] };
        setResults(data.results);
        setActive(-1);
      } catch {
        /* aborted or offline: keep the last results */
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(result: Result) {
    setOpen(false);
    setExpanded(false);
    setQuery('');
    setResults(null);
    router.push(`/u/${result.username}`);
  }

  const shown = trimmed.length >= MIN_LENGTH ? results : null;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setExpanded(false);
      inputRef.current?.blur();
      return;
    }
    if (!shown?.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      go(shown[active]);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-[var(--ps-radius-md)] text-ps-muted hover:bg-ps-paper-elevated sm:hidden dark:text-ps-muted-on-dark dark:hover:bg-ps-ink-2"
        aria-label="Find players"
        onClick={() => {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>

      <div
        className={`${expanded ? 'fixed inset-x-3 top-3 z-50 flex' : 'hidden'} items-center sm:static sm:flex`}
      >
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ps-muted dark:text-ps-muted-on-dark sm:left-3" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && shown !== null}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Find players"
          placeholder="Find players"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          maxLength={50}
          className="h-10 w-full rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper-elevated pl-9 pr-9 text-sm text-ps-text placeholder:text-ps-muted focus:border-[var(--ps-lime)] focus:outline-none sm:h-9 sm:w-56 lg:w-72 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-text-on-dark dark:placeholder:text-ps-muted-on-dark"
        />
        {expanded && (
          <button
            type="button"
            className="absolute right-2 p-1 text-ps-muted sm:hidden"
            aria-label="Close search"
            onClick={() => {
              setExpanded(false);
              setOpen(false);
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {open && shown !== null && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated py-1 shadow-ps-shadow-lg sm:right-auto sm:w-80 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2"
          >
            {shown.length === 0 ? (
              <li className="px-4 py-3 text-sm text-ps-muted dark:text-ps-muted-on-dark">
                No one found. Players only appear here if they&apos;ve chosen to be findable.
              </li>
            ) : (
              shown.map((result, index) => (
                <li
                  key={result.username}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    go(result);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${index === active ? 'bg-ps-paper dark:bg-ps-ink-3' : ''}`}
                >
                  <Avatar src={result.avatarUrl} name={result.displayName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
                      {result.displayName}
                    </span>
                    <span className="block truncate text-xs text-ps-muted dark:text-ps-muted-on-dark">@{result.username}</span>
                  </span>
                  {result.isLive ? (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Live</span>
                  ) : result.isStreamer ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">Streamer</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
