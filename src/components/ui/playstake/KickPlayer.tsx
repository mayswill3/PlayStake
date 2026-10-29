'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * KickPlayer — embeds a channel's live Kick player via the public embed URL.
 *
 * Muted unless the page says otherwise. Match pages play the other
 * participants with sound and keep the viewer's own stream muted: hearing
 * your own stream back is picked up by your microphone or desktop-audio
 * capture and echoes onto your broadcast. <ListenButton> mutes or unmutes a
 * feed. Changing `muted` reloads the player (Kick's embed takes it as a URL
 * parameter).
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

/** Mute or unmute one stream. */
export function ListenButton({ listening, onToggle, name }: { listening: boolean; onToggle: () => void; name: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={listening}
      aria-label={listening ? `Mute ${name}` : `Unmute ${name}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${
        listening ? 'bg-ps-lime text-ps-ink' : 'text-ps-lime hover:bg-ps-lime/10'
      }`}
    >
      {listening ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{listening ? 'Sound on' : 'Muted'}</span>
    </button>
  );
}

/** Shown wherever streams play while people are likely to be streaming. */
export function StreamAudioTip({ audience = 'player' }: { audience?: 'player' | 'referee' }) {
  return (
    <div className="space-y-1 text-xs text-ps-muted dark:text-ps-muted-on-dark">
      {audience === 'referee' ? (
        <p>
          <strong className="text-ps-text dark:text-ps-text-on-dark">Instructions go in match chat.</strong> Kick
          streams run a few seconds behind, so players hear you late on your stream; match chat reaches them straight
          away.
        </p>
      ) : (
        <p>
          <strong className="text-ps-text dark:text-ps-text-on-dark">Talking to your opponent?</strong> Kick streams
          run a few seconds behind, so use the game&apos;s voice chat or a PlayStation or Xbox party to talk in real
          time. Say anything for the referee on your stream; their instructions appear in match chat.
        </p>
      )}
      <p>
        Your own stream is muted here so you don&apos;t hear yourself. Streaming? Wear headphones, or capture only your
        game&apos;s audio (not desktop audio), so the other streams&apos; sound isn&apos;t picked up and echoed on yours.
      </p>
    </div>
  );
}

/**
 * The signed-in user's own Kick channel, so their own stream is never played
 * with sound. `undefined` while loading (callers keep everything muted until
 * it's known), `null` when they have no channel.
 */
export function useOwnKickChannel(): string | null | undefined {
  const [slug, setSlug] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/kick', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { channelSlug?: string | null } | null) => {
        if (!cancelled) setSlug(data?.channelSlug?.toLowerCase() ?? null);
      })
      .catch(() => {
        if (!cancelled) setSlug(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return slug;
}
