import { Scale } from 'lucide-react';
import { KickPlayer } from '@/components/ui/playstake/KickPlayer';

export interface StreamSource {
  name: string;
  channelSlug: string | null;
  isLive: boolean;
}

/**
 * A refereed match's Kick feeds: the referee featured large and centred on
 * top — they're the one making the call — with both players side by side
 * underneath. Used on the participant bet page and the spectator page.
 */
export function MatchStreams({
  referee,
  players,
}: {
  referee: StreamSource | null;
  players: StreamSource[];
}) {
  const playerStreams = players.filter((p) => p.channelSlug);
  const refereeStream = referee?.channelSlug ? referee : null;
  if (!refereeStream && playerStreams.length === 0) return null;

  return (
    <div className="space-y-6">
      {refereeStream && (
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-ps-lime/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ps-lime">
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              Referee cam
            </span>
            <p className="truncate font-display text-base font-semibold text-ps-text dark:text-ps-text-on-dark">
              {refereeStream.name}
            </p>
            <LiveBadge live={refereeStream.isLive} />
          </div>
          <div className="rounded-[calc(var(--ps-radius-md)+3px)] p-[3px] ring-1 ring-ps-lime/50 shadow-[0_0_40px_-12px_var(--ps-lime)]">
            <KickPlayer slug={refereeStream.channelSlug!} />
          </div>
        </div>
      )}

      {playerStreams.length > 0 && (
        <div className={`grid grid-cols-1 gap-4 ${playerStreams.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {playerStreams.map((player) => (
            <div key={player.channelSlug}>
              <div className="mb-2 flex items-center gap-2">
                <p className="truncate font-display text-sm font-medium text-ps-text dark:text-ps-text-on-dark">
                  {player.name}
                </p>
                <LiveBadge live={player.isLive} />
              </div>
              <KickPlayer slug={player.channelSlug!} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LiveBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ps-error/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ps-error">
      <span className="h-1.5 w-1.5 rounded-full bg-ps-error animate-pulse" />
      Live
    </span>
  ) : (
    <span className="text-[10px] font-mono uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
      Offline
    </span>
  );
}
