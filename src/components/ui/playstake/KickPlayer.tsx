'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * KickPlayer — embeds a channel's live Kick player via the public embed URL.
 *
 * Starts **muted** by default. Players and referees are usually streaming
 * while they watch, and an unmuted stream on this page is picked up by their
 * microphone or desktop-audio capture and sent back out on their own stream:
 * an echo / feedback loop. Pages unmute one stream at a time with
 * <ListenButton>. Changing `muted` reloads the player (Kick's embed takes it
 * as a URL parameter).
 *
 * @example
 * ```tsx
 * <KickPlayer slug="kwasi88" />
 * <KickPlayer slug="kwasi88" muted={false} />
 * ```
 */
export function KickPlayer({ slug, muted = true }: { slug: string; muted?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-black">
      <iframe
        src={`https://player.kick.com/${slug}?autoplay=true&muted=${muted ? 'true' : 'false'}`}
        title={`${slug} on Kick`}
        className="w-full aspect-video"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
      />
    </div>
  );
}

/** Turn one stream's sound on (the page mutes the others). */
export function ListenButton({ listening, onToggle, name }: { listening: boolean; onToggle: () => void; name: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={listening}
      aria-label={listening ? `Mute ${name}` : `Listen to ${name}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${
        listening ? 'bg-ps-lime text-ps-ink' : 'text-ps-lime hover:bg-ps-lime/10'
      }`}
    >
      {listening ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{listening ? 'Listening' : 'Listen'}</span>
    </button>
  );
}

/** Shown wherever streams play while people are likely to be streaming. */
export function StreamAudioTip() {
  return (
    <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
      Streams start muted; turn on one at a time. Streaming yourself? Wear headphones, or capture only your game&apos;s
      audio (not desktop audio), so this page&apos;s sound isn&apos;t picked up and echoed on your stream.
    </p>
  );
}

/** The signed-in user's own Kick channel, so their own stream is never played with sound. */
export function useOwnKickChannel(): string | null {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/kick', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { channelSlug?: string | null } | null) => {
        if (!cancelled) setSlug(data?.channelSlug?.toLowerCase() ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return slug;
}
