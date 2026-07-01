'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Hash,
  TrendingUp,
  DollarSign,
  Activity,
  Plus,
  List,
  Gamepad2,
  ChevronRight,
  ArrowRight,
  Layers,
  Grid3x3,
  Target,
  Radio,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { SkeletonCard, SkeletonTableRow } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { KickPlayer } from '@/components/ui/playstake/KickPlayer';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { GlowCard } from '@/components/ui/playstake/GlowCard';
import { IconTile } from '@/components/ui/playstake/IconTile';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useAuthLayout } from '@/hooks/useAuthLayout';
import { formatCents, formatPercent, formatDate } from '@/lib/utils/format';

interface DashboardStats {
  totalBets: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  netProfit: number;
  activeBets: number;
}

interface RecentBet {
  id: string;
  gameName: string;
  opponent: { displayName: string } | null;
  amount: number;
  status: string;
  outcome: string | null;
  myRole: string;
  netResult: number | null;
  createdAt: string;
}

type PillStatus = 'live' | 'waiting' | 'completed' | 'disputed' | 'settled' | 'expired';

function mapBetStatusToPill(status: string): PillStatus {
  switch (status) {
    case 'OPEN':
    case 'PENDING':
    case 'PENDING_CONSENT':
      return 'waiting';
    case 'MATCHED':
    case 'RESULT_REPORTED':
      return 'live';
    case 'SETTLED':
      return 'settled';
    case 'DISPUTED':
      return 'disputed';
    case 'CANCELLED':
    case 'VOIDED':
    case 'EXPIRED':
      return 'expired';
    default:
      return 'waiting';
  }
}

const QUICK_PLAY_GAMES = [
  { name: 'Higher / Lower', description: 'Guess the next card', href: '/play/cards', icon: Layers },
  { name: 'Tic-Tac-Toe', description: 'Classic strategy game', href: '/play/tictactoe', icon: Grid3x3 },
  { name: 'Darts 301', description: 'Aim and throw to zero', href: '/play/darts', icon: Target },
];

function timeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const KICK_STATUS_MESSAGES: Record<string, { type: 'success' | 'error' | 'info'; message: string }> = {
  linked: { type: 'success', message: 'Kick channel connected.' },
  denied: { type: 'info', message: 'Kick connection was cancelled.' },
  invalid: { type: 'error', message: 'Kick connection failed: invalid request. Please try again.' },
  already_linked: { type: 'error', message: 'That Kick channel is already linked to another account.' },
  failed: { type: 'error', message: 'Could not connect your Kick channel. Please try again.' },
};

export default function DashboardPage() {
  const { user } = useAuthLayout();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBets, setRecentBets] = useState<RecentBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Surface feedback from the Kick OAuth callback redirect (/dashboard?kick=...)
  // then strip the param so it doesn't re-fire on refresh.
  useEffect(() => {
    const kick = searchParams.get('kick');
    if (!kick) return;
    const feedback = KICK_STATUS_MESSAGES[kick];
    if (feedback) toast(feedback.type, feedback.message);
    router.replace('/dashboard');
  }, [searchParams, toast, router]);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/bets?limit=5').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([statsData, betsData]) => {
        if (statsData) setStats(statsData);
        if (betsData) setRecentBets(betsData.data || []);
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <div className="h-8 w-64 bg-ps-paper-elevated dark:bg-ps-ink-2 rounded-[var(--ps-radius-md)] animate-pulse" />
          <div className="h-4 w-72 bg-ps-paper-elevated dark:bg-ps-ink-2 rounded-[var(--ps-radius-md)] animate-pulse mt-2" />
        </div>
        <div className="h-48 bg-ps-paper-elevated dark:bg-ps-ink-2 rounded-[var(--ps-radius-lg)] animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper-elevated dark:bg-ps-ink-2 p-6">
          <div className="h-6 w-32 bg-ps-paper dark:bg-ps-ink-3 rounded-[var(--ps-radius-md)] animate-pulse mb-4" />
          {Array.from({ length: 5 }, (_, i) => <SkeletonTableRow key={i} cols={4} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-[var(--ps-radius-md)] bg-ps-error/10 border border-ps-error/25 text-ps-error text-sm">
        {error}
      </div>
    );
  }

  const isProfitPositive = (stats?.netProfit ?? 0) > 0;
  const isProfitNegative = (stats?.netProfit ?? 0) < 0;

  return (
    <FadeIn>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Greeting header */}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ps-text dark:text-ps-text-on-dark">
            Good {timeOfDay()}, {user?.displayName || 'Player'}
          </h1>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark mt-1">
            Your betting overview and quick actions
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
          {/* Main column */}
          <div className="space-y-6 min-w-0">
            {/* Play Now section */}
            <PlayNowSection />

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Bets"
                value={String(stats?.totalBets ?? 0)}
                subtext="All time"
                icon={Hash}
                accent="neutral"
              />
              <StatCard
                label="Win Rate"
                value={stats ? formatPercent(stats.winRate) : '0%'}
                subtext={stats ? `${stats.wins}W / ${stats.losses}L / ${stats.draws}D` : undefined}
                icon={TrendingUp}
                accent="neutral"
              />
              <StatCard
                label="Net Profit"
                value={formatCents(stats?.netProfit ?? 0)}
                subtext={stats?.totalWagered ? `of ${formatCents(stats.totalWagered)} wagered` : undefined}
                icon={DollarSign}
                accent={isProfitPositive ? 'positive' : isProfitNegative ? 'negative' : 'neutral'}
              />
              <StatCard
                label="Active Bets"
                value={String(stats?.activeBets ?? 0)}
                subtext={stats?.activeBets ? 'In progress' : 'None active'}
                icon={Activity}
                accent="neutral"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Link href="/wallet/deposit">
                <PSButton variant="primary" icon={<Plus size={16} />}>
                  Deposit Funds
                </PSButton>
              </Link>
              <Link href="/bets">
                <PSButton variant="secondary" icon={<List size={16} />}>
                  View All Bets
                </PSButton>
              </Link>
            </div>

            {/* Recent bets */}
            <RecentBetsSection bets={recentBets} />

            {/* Connections */}
            <KickConnectionCard />
          </div>

          {/* Right rail */}
          <aside className="space-y-6">
            <LiveNowRail />
          </aside>
        </div>
      </div>
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// Kick Connection
// ---------------------------------------------------------------------------

interface KickStatus {
  connected: boolean;
  channelSlug?: string | null;
  displayName?: string | null;
  profilePicture?: string | null;
  isLive?: boolean;
  lastLiveAt?: string | null;
}

function KickConnectionCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<KickStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch('/api/user/kick')
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then((data) => setStatus(data))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/user/kick', { method: 'DELETE' });
      if (!res.ok) {
        toast('error', 'Failed to disconnect Kick.');
        return;
      }
      setStatus({ connected: false });
      toast('success', 'Kick channel disconnected.');
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status?.connected;
  const slug = status?.channelSlug;
  const isLive = connected && status?.isLive;

  return (
    <div className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper-elevated dark:bg-ps-ink-2 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-[var(--ps-radius-md)] bg-ps-lime/10 text-ps-lime flex items-center justify-center">
            <Radio size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-display font-semibold text-ps-text dark:text-ps-text-on-dark">Kick</p>
              {!loading && connected && <Badge variant="success">Connected</Badge>}
              {!loading && isLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ps-error/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ps-error">
                  <span className="h-1.5 w-1.5 rounded-full bg-ps-error animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark mt-0.5 truncate">
              {loading
                ? 'Checking connection…'
                : connected
                ? slug
                  ? `Linked to kick.com/${slug}`
                  : `Linked as ${status?.displayName ?? 'your channel'}`
                : 'Connect your Kick channel to watch your stream here.'}
            </p>
          </div>
        </div>
        {!loading && (
          connected ? (
            <PSButton
              variant="secondary"
              size="sm"
              loading={disconnecting}
              onClick={handleDisconnect}
            >
              Disconnect
            </PSButton>
          ) : (
            <a href="/api/auth/kick">
              <PSButton variant="primary" size="sm" icon={<Radio size={15} />}>
                Connect Kick
              </PSButton>
            </a>
          )
        )}
      </div>

      {/* Embedded Kick player — shows the channel's live stream (or its offline
          screen) directly on PlayStake. Free; no streaming infra required. */}
      {!loading && connected && slug && (
        <div className="mt-4">
          <KickPlayer slug={slug} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live Now rail
// ---------------------------------------------------------------------------

interface LiveStreamer {
  displayName: string | null;
  channelSlug: string | null;
  profilePicture: string | null;
  thumbnail: string | null;
  viewerCount: number | null;
  title: string | null;
}

function LiveNowRail() {
  const [live, setLive] = useState<LiveStreamer[] | null>(null);
  // Bumped on each poll; passed to cards so they retry a not-yet-ready
  // thumbnail (see LiveStreamerCard) instead of caching Kick's initial 404.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch('/api/kick/live')
        .then((r) => (r.ok ? r.json() : { live: [] }))
        .then((data) => active && setLive(data.live ?? []))
        .catch(() => active && setLive([]));
    load();
    const id = setInterval(() => {
      if (!active) return;
      setRefreshKey((k) => k + 1);
      load();
    }, 45000); // refresh live status periodically
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper-elevated dark:bg-ps-ink-2 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-2 w-2 rounded-full bg-ps-error animate-pulse" />
        <h2 className="text-base font-display font-semibold text-ps-text dark:text-ps-text-on-dark">
          Live Now
        </h2>
        {live && live.length > 0 && (
          <span className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark">
            {live.length}
          </span>
        )}
      </div>

      {live === null ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="aspect-video rounded-[var(--ps-radius-md)] bg-ps-paper dark:bg-ps-ink-3 animate-pulse" />
          ))}
        </div>
      ) : live.length === 0 ? (
        <div className="py-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--ps-radius-lg)] bg-ps-paper dark:bg-ps-ink-3 text-ps-muted dark:text-ps-muted-on-dark mb-2">
            <Radio size={18} />
          </div>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">No one is live right now</p>
        </div>
      ) : (
        <div className="space-y-4">
          {live.map((s) => (
            <LiveStreamerCard key={s.channelSlug} streamer={s} refreshKey={refreshKey} />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveStreamerCard({ streamer, refreshKey }: { streamer: LiveStreamer; refreshKey: number }) {
  const { displayName, channelSlug, profilePicture, thumbnail, viewerCount, title } = streamer;
  // Kick doesn't generate a live thumbnail until a stream has been up for a
  // minute or two, so the URL 404s early on and older browsers cache that
  // failure. Retry on each poll and swap to a clean placeholder if it fails,
  // rather than showing the browser's broken-image glyph.
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => {
    setThumbFailed(false);
  }, [thumbnail, refreshKey]);

  if (!channelSlug) return null;

  const thumbSrc =
    thumbnail && !thumbFailed
      ? `${thumbnail}${thumbnail.includes('?') ? '&' : '?'}_=${refreshKey}`
      : null;

  return (
    <Link href={`/streams/${channelSlug}`} className="group block">
      <div className="relative overflow-hidden rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-black aspect-video">
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt={`${channelSlug} live`}
            onError={() => setThumbFailed(true)}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ps-muted-on-dark">
            <Radio size={22} />
          </div>
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded bg-ps-error px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Live
        </span>
        {viewerCount !== null && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
            {viewerCount.toLocaleString()} watching
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {profilePicture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profilePicture} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ps-lime/15 text-ps-lime text-[10px] font-bold">
            {(displayName || channelSlug).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-ps-text dark:text-ps-text-on-dark truncate">
            {displayName || channelSlug}
          </p>
          {title && (
            <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark truncate">{title}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Play Now Section
// ---------------------------------------------------------------------------

function PlayNowSection() {
  return (
    <section
      className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper-elevated dark:bg-ps-ink-2 p-5 lg:p-6"
      style={{ borderTopWidth: '2px', borderTopColor: 'var(--ps-lime)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-display font-semibold text-ps-text dark:text-ps-text-on-dark flex items-center gap-2">
            <Gamepad2 size={20} className="text-ps-lime" />
            Ready to play?
          </h2>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark mt-0.5">
            Choose a game and challenge an opponent
          </p>
        </div>
        <Link
          href="/play"
          className="hidden sm:inline-flex items-center gap-1 text-sm text-ps-lime font-semibold hover:gap-2 transition-all"
        >
          Browse all games
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* Mobile: horizontal scroll; Desktop: 4-col grid */}
      <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory lg:grid lg:grid-cols-4 lg:gap-3 lg:pb-0 lg:overflow-visible">
        {QUICK_PLAY_GAMES.map((game) => (
          <QuickPlayCard key={game.href} {...game} />
        ))}
      </div>

      <Link
        href="/play"
        className="sm:hidden mt-4 inline-flex items-center gap-1 text-sm text-ps-lime font-semibold"
      >
        Browse all games
        <ChevronRight size={14} />
      </Link>
    </section>
  );
}

interface QuickPlayCardProps {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

function QuickPlayCard({ name, description, href, icon: Icon }: QuickPlayCardProps) {
  return (
    <Link
      href={href}
      className="group snap-start min-w-[200px] lg:min-w-0 flex flex-col gap-3 p-4 rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper dark:bg-ps-ink hover:border-ps-lime/40 hover:-translate-y-0.5 transition-all"
    >
      <IconTile icon={<Icon className="h-full w-full" />} size="sm" />
      <div className="flex-1">
        <p className="font-semibold text-ps-text dark:text-ps-text-on-dark text-sm">{name}</p>
        <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark mt-0.5">{description}</p>
      </div>
      <div className="border-t border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] pt-3">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-ps-lime group-hover:gap-2 transition-all">
          Play Now
          <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  accent: 'neutral' | 'positive' | 'negative';
}

function StatCard({ label, value, subtext, icon: Icon, accent }: StatCardProps) {
  const accentStyles = {
    neutral: {
      border: 'border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]',
      iconBg: 'bg-ps-paper-elevated dark:bg-ps-ink-2',
      iconColor: 'text-ps-muted dark:text-ps-muted-on-dark',
      valueColor: 'text-ps-text dark:text-ps-text-on-dark',
    },
    positive: {
      border: 'border-ps-lime/30',
      iconBg: 'bg-ps-lime/10',
      iconColor: 'text-ps-lime',
      valueColor: 'text-ps-lime',
    },
    negative: {
      border: 'border-ps-error/30',
      iconBg: 'bg-ps-error/10',
      iconColor: 'text-ps-error',
      valueColor: 'text-ps-error',
    },
  }[accent];

  return (
    <div className={`rounded-[var(--ps-radius-lg)] border ${accentStyles.border} bg-ps-paper-elevated dark:bg-ps-ink-2 p-5 transition-colors hover:border-ps-lime/20`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-ps-muted dark:text-ps-muted-on-dark uppercase tracking-wider">
          {label}
        </p>
        <div className={`h-8 w-8 rounded-[var(--ps-radius-md)] flex items-center justify-center ${accentStyles.iconBg} ${accentStyles.iconColor}`}>
          <Icon size={15} strokeWidth={2.5} />
        </div>
      </div>
      <p className={`font-display text-2xl font-bold tabular-nums ${accentStyles.valueColor}`}>
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark mt-1">{subtext}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Bets Section
// ---------------------------------------------------------------------------

function RecentBetsSection({ bets }: { bets: RecentBet[] }) {
  if (bets.length === 0) {
    return (
      <div className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper-elevated dark:bg-ps-ink-2 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-display font-semibold text-ps-text dark:text-ps-text-on-dark">Recent Bets</h2>
        </div>
        <div className="py-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--ps-radius-lg)] bg-ps-paper dark:bg-ps-ink-3 text-ps-muted dark:text-ps-muted-on-dark mb-3">
            <Gamepad2 size={24} />
          </div>
          <p className="text-sm font-medium text-ps-text dark:text-ps-text-on-dark">No bets yet</p>
          <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark mt-1">
            Play a game and place your first bet
          </p>
          <Link href="/play" className="inline-block mt-4">
            <PSButton variant="primary" icon={<Gamepad2 size={15} />}>
              Find a game
            </PSButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper-elevated dark:bg-ps-ink-2 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-display font-semibold text-ps-text dark:text-ps-text-on-dark">Recent Bets</h2>
        <Link
          href="/bets"
          className="text-sm text-ps-lime font-semibold hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {bets.map((bet) => (
          <BetRow key={bet.id} bet={bet} />
        ))}
      </div>
    </div>
  );
}

function BetRow({ bet }: { bet: RecentBet }) {
  const isWin = bet.netResult !== null && bet.netResult > 0;
  const isLoss = bet.netResult !== null && bet.netResult < 0;
  const isVoided = bet.status === 'VOIDED' || bet.status === 'CANCELLED';

  let borderClass = 'border-l-[var(--ps-border-light)] dark:border-l-[var(--ps-border-dark)]';
  if (isVoided) borderClass = 'border-l-ps-muted dark:border-l-ps-muted-on-dark';
  else if (isWin) borderClass = 'border-l-ps-lime';
  else if (isLoss) borderClass = 'border-l-ps-error';

  return (
    <Link
      href={`/bets/${bet.id}`}
      className={`flex items-center justify-between p-3 pl-4 rounded-[var(--ps-radius-md)] border-l-2 ${borderClass} hover:bg-ps-paper dark:hover:bg-ps-ink-3 transition-colors`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ps-text dark:text-ps-text-on-dark truncate">{bet.gameName}</p>
          <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark mt-0.5">
            vs {bet.opponent?.displayName ?? 'Awaiting opponent'} · {formatDate(bet.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <StatusPill status={mapBetStatusToPill(bet.status)} label={bet.status.replace(/_/g, ' ')} />
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-ps-text dark:text-ps-text-on-dark">
            {formatCents(bet.amount)}
          </p>
          {bet.netResult !== null && (
            <p
              className={`text-xs font-semibold tabular-nums ${
                bet.netResult > 0
                  ? 'text-ps-lime'
                  : bet.netResult < 0
                  ? 'text-ps-error'
                  : 'text-ps-muted dark:text-ps-muted-on-dark'
              }`}
            >
              {bet.netResult > 0 ? '+' : ''}{formatCents(bet.netResult)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
