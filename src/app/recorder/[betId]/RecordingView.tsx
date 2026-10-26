'use client';

import { useEffect, useState } from 'react';

interface View {
  betId: string;
  gameName: string;
  stakeAmount: number;
  startedAt: string | null;
  status: string;
  streams: Record<'playerA' | 'playerB' | 'referee', { name: string; channel: string | null }>;
  events: Array<{ action: string; at: string }>;
  chat: Array<{ name: string; body: string; at: string }>;
}

const EVENT_LABEL: Record<string, string> = {
  MATCH_STARTED: 'Referee started the match',
  DECISION_SUBMITTED: 'Referee recorded the result',
  DISPUTE_FILED: 'Dispute filed',
  ASSIGNMENT_CANCELLED: 'Match cancelled',
  MATCH_OVERRUN: 'Match ran past 2 hours',
};

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function Stream({ label, name, channel }: { label: string; name: string; channel: string | null }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      {channel ? (
        <iframe
          src={`https://player.kick.com/${channel}?autoplay=true&muted=false`}
          title={`${name} on Kick`}
          allow="autoplay; fullscreen"
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      ) : (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          No Kick channel
        </div>
      )}
      <div
        style={{
          position: 'absolute', left: 12, top: 12, padding: '4px 10px', borderRadius: 6,
          background: 'rgba(0,0,0,0.7)', color: '#fff', font: '600 18px/1.3 Arial, sans-serif',
        }}
      >
        {label} · {name}{channel ? ` · kick.com/${channel}` : ''}
      </div>
    </div>
  );
}

/** Fixed 1920×1080 so the recording frame never changes size. */
export function RecordingView({ betId, token }: { betId: string; token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/recorder/${betId}?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (res.ok && !cancelled) setView(await res.json());
      } catch {
        /* keep the last view; the recording carries on */
      }
    };
    void load();
    const poll = setInterval(load, 3000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [betId, token]);

  // The recorder captures exactly 1920×1080: no margins or scrollbars.
  const reset = <style>{'html,body{margin:0;padding:0;overflow:hidden;background:#0b0f17}'}</style>;
  const base: React.CSSProperties = { width: 1920, height: 1080, background: '#0b0f17', color: '#fff', overflow: 'hidden', font: '16px Arial, sans-serif' };
  if (!view) {
    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {reset}Loading match…
      </div>
    );
  }

  const start = view.startedAt ? new Date(view.startedAt).getTime() : null;
  const rel = (at: string) => (start ? `+${clock(new Date(at).getTime() - start)}` : '');
  const events = view.events.filter((event) => EVENT_LABEL[event.action]).slice(-4);

  return (
    <div style={{ ...base, display: 'grid', gridTemplateColumns: '960px 960px', gridTemplateRows: '540px 540px' }}>
      {reset}
      <Stream label="PLAYER A" name={view.streams.playerA.name} channel={view.streams.playerA.channel} />
      <Stream label="PLAYER B" name={view.streams.playerB.name} channel={view.streams.playerB.channel} />
      <div style={{ gridColumn: '1 / span 2', display: 'grid', gridTemplateColumns: '640px 1280px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 640, height: 360 }}>
            <Stream label="REFEREE" name={view.streams.referee.name} channel={view.streams.referee.channel} />
          </div>
          <div style={{ padding: '16px 20px', color: '#9ca3af', font: '15px/1.5 Arial, sans-serif' }}>
            Recorded by PlayStake for dispute review. Streams are shown through Kick&apos;s player, exactly as
            the referee saw them. The fingerprint of this file is kept in the match&apos;s audit trail.
          </div>
        </div>
        <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 18, borderLeft: '1px solid #1f2937' }}>
          <div style={{ color: '#5fdcb2', font: '700 20px Arial, sans-serif', letterSpacing: 2 }}>PLAYSTAKE MATCH RECORDING</div>
          <div style={{ font: '700 30px Arial, sans-serif' }}>
            {view.gameName} · {view.streams.playerA.name} vs {view.streams.playerB.name}
          </div>
          <div style={{ display: 'flex', gap: 48, font: '700 56px "Courier New", monospace' }}>
            <div>
              <div style={{ font: '600 16px Arial, sans-serif', color: '#9ca3af' }}>MATCH TIME</div>
              {start ? clock(now - start) : '--:--'}
            </div>
            <div>
              <div style={{ font: '600 16px Arial, sans-serif', color: '#9ca3af' }}>UTC</div>
              {new Date(now).toISOString().slice(11, 19)}
            </div>
          </div>
          <div style={{ color: '#9ca3af', font: '15px Arial, sans-serif' }}>
            Match {view.betId} · £{view.stakeAmount.toFixed(2)} each · {new Date(now).toISOString().slice(0, 10)}
          </div>
          <div>
            <div style={{ font: '600 16px Arial, sans-serif', color: '#9ca3af', marginBottom: 6 }}>EVENTS</div>
            {events.length === 0 ? <div style={{ color: '#6b7280' }}>—</div> : events.map((event, index) => (
              <div key={index} style={{ font: '20px Arial, sans-serif' }}>
                <span style={{ fontFamily: '"Courier New", monospace', color: '#5fdcb2' }}>{rel(event.at)}</span> {EVENT_LABEL[event.action]}
              </div>
            ))}
          </div>
          <div style={{ minHeight: 0 }}>
            <div style={{ font: '600 16px Arial, sans-serif', color: '#9ca3af', marginBottom: 6 }}>MATCH CHAT</div>
            {view.chat.slice(-5).map((message, index) => (
              <div key={index} style={{ font: '18px Arial, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ fontFamily: '"Courier New", monospace', color: '#9ca3af' }}>{rel(message.at)}</span>{' '}
                <b>{message.name}:</b> {message.body}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
