'use client';

import { useEffect, useState } from 'react';
import { Mic, MicOff, PhoneOff, Radio } from 'lucide-react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
} from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { PSButton } from '@/components/ui/playstake/PSButton';

interface Availability {
  available: boolean;
  reason?: string;
  recorded?: boolean;
}

interface Connection {
  serverUrl: string;
  token: string;
}

const ROLE_LABEL: Record<string, string> = { PLAYER_A: 'Player A', PLAYER_B: 'Player B', REFEREE: 'Referee' };

function roleOf(participant: Participant): string | null {
  try {
    return (JSON.parse(participant.metadata ?? '{}') as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

function ParticipantRow({ participant }: { participant: Participant }) {
  const speaking = useIsSpeaking(participant);
  const role = roleOf(participant);
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${speaking ? 'bg-ps-lime shadow-[0_0_8px_var(--ps-lime)]' : 'bg-ps-muted/40'}`}
        aria-hidden="true"
      />
      <span className="truncate text-ps-text dark:text-ps-text-on-dark">
        {participant.name || 'Someone'}
        {participant.isLocal ? ' (you)' : ''}
      </span>
      {role && <span className="text-[11px] text-ps-muted dark:text-ps-muted-on-dark">{ROLE_LABEL[role] ?? role}</span>}
      {!participant.isMicrophoneEnabled && <MicOff className="h-3.5 w-3.5 text-ps-muted" aria-label="muted" />}
    </li>
  );
}

function InRoom({ onLeave }: { onLeave: () => void }) {
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5" aria-label="In the voice chat">
        {participants.map((participant) => (
          <ParticipantRow key={participant.identity} participant={participant} />
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <PSButton
          size="sm"
          variant={isMicrophoneEnabled ? 'ghost' : 'primary'}
          onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? <Mic className="mr-1 h-4 w-4" /> : <MicOff className="mr-1 h-4 w-4" />}
          {isMicrophoneEnabled ? 'Mute my mic' : 'Unmute my mic'}
        </PSButton>
        <PSButton size="sm" variant="ghost" onClick={onLeave}>
          <PhoneOff className="mr-1 h-4 w-4" />
          Leave voice
        </PSButton>
      </div>
      <RoomAudioRenderer />
    </div>
  );
}

/**
 * Live voice for the match: the two players and the referee. Kick streams run
 * seconds behind; this is real time. Joining is a click (the browser needs
 * one to use the microphone and play sound). `onActiveChange` lets the page
 * mute the Kick streams while voice is on, so voices aren't heard twice.
 */
export function MatchVoice({ betId, onActiveChange }: { betId: string; onActiveChange?: (active: boolean) => void }) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [connection, setConnectionState] = useState<Connection | null>(null);
  const setConnection = (next: Connection | null) => {
    setConnectionState(next);
    onActiveChange?.(next !== null);
  };
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/bets/${betId}/voice`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: Availability | null) => !cancelled && setAvailability(data))
        .catch(() => {});
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [betId]);

  if (!availability?.available && !connection) return null;

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const response = await fetch(`/api/bets/${betId}/voice`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Could not join voice chat');
      setConnection({ serverUrl: data.serverUrl, token: data.token });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join voice chat');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] p-4 dark:border-[var(--ps-border-dark)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Radio className="h-4 w-4 text-ps-lime" aria-hidden="true" />
        <p className="font-display font-semibold text-ps-text dark:text-ps-text-on-dark">Match voice chat</p>
        <span className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
          Live, no delay · players and referee only{availability?.recorded ? ' · recorded for dispute review' : ''}
        </span>
      </div>
      {connection ? (
        <LiveKitRoom
          serverUrl={connection.serverUrl}
          token={connection.token}
          connect
          audio={{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }}
          video={false}
          onDisconnected={() => setConnection(null)}
          onError={(e) => setError(e.message)}
          onMediaDeviceFailure={() => setError('We could not use your microphone. Check your browser allows it for this site.')}
        >
          <InRoom onLeave={() => setConnection(null)} />
        </LiveKitRoom>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">
            Talk to your opponent and the referee in real time. Your browser will ask to use your microphone. Use
            headphones so the other voices aren&apos;t picked up by your mic or your stream.
          </p>
          <PSButton size="sm" disabled={joining} onClick={join}>
            <Mic className="mr-1 h-4 w-4" />
            {joining ? 'Joining…' : 'Join voice'}
          </PSButton>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-ps-error">{error}</p>}
    </div>
  );
}
