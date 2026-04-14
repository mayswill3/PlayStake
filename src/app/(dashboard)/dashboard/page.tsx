'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { SkeletonCard, SkeletonTableRow } from '@/components/ui/Skeleton';
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

const QUICK_PLAY_GAMES = [
  { name: 'Higher / Lower', description: 'Guess the next card', href: '/play/cards', icon: Layers },
  { name: 'Tic-Tac-Toe', description: 'Classic strategy game', href: '/play/tictactoe', icon: Grid3x3 },
];

function timeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export default function DashboardPage() {
  const { user } = useAuthLayout();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBets, setRecentBets] = useState<RecentBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          <div className="h-8 w-64 bg-elevated rounded animate-pulse" />
          <div className="h-4 w-72 bg-elevated rounded animate-pulse mt-2" />
        </div>
        <div className="h-48 bg-elevated rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="rounded-2xl border border-themed bg-card p-6">
          <div className="h-6 w-32 bg-elevated rounded animate-pulse mb-4" />
          {Array.from({ length: 5 }, (_, i) => <SkeletonTableRow key={i} cols={4} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-500 text-sm">
        {error}
      </div>
    );
  }

  const isProfitPositive = (stats?.netProfit ?? 0) > 0;
  const isProfitNegative = (stats?.netProfit ?? 0) < 0;

  return (
    <FadeIn>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Greeting header */}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-fg">
            Good {timeOfDay()}, {user?.displayName || 'Player'} 👋
          </h1>
          <p className="text-sm text-fg-secondary mt-1">
            Your betting overview and quick actions
          </p>
        </div>

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
          <Link
            href="/wallet/deposit"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            <Plus size={16} />
            Deposit Funds
          </Link>
          <Link
            href="/bets"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-themed bg-card text-fg text-sm font-medium hover:bg-elevated transition-colors"
          >
            <List size={16} />
            View All Bets
          </Link>
        </div>

        {/* Recent bets */}
        <RecentBetsSection bets={recentBets} />
      </div>
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// Play Now Section
// ---------------------------------------------------------------------------

function PlayNowSection() {
  return (
    <section
      className="rounded-2xl border border-themed bg-card p-5 lg:p-6"
      style={{ borderTopWidth: '2px', borderTopColor: '#16a34a' }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-display font-semibold text-fg flex items-center gap-2">
            <Gamepad2 size={20} className="text-brand-600 dark:text-brand-400" />
            Ready to play?
          </h2>
          <p className="text-sm text-fg-secondary mt-0.5">
            Choose a game and challenge an opponent
          </p>
        </div>
        <Link
          href="/play"
          className="hidden sm:inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 font-semibold hover:gap-2 transition-all"
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
        className="sm:hidden mt-4 inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 font-semibold"
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
      className="group snap-start min-w-[200px] lg:min-w-0 flex flex-col gap-3 p-4 rounded-xl border border-themed bg-page hover:border-brand-600/40 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-400">
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-fg text-sm">{name}</p>
        <p className="text-xs text-fg-muted mt-0.5">{description}</p>
      </div>
      <div className="border-t border-themed pt-3">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400 group-hover:gap-2 transition-all">
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
      border: 'border-themed',
      iconBg: 'bg-elevated',
      iconColor: 'text-fg-secondary',
      valueColor: 'text-fg',
    },
    positive: {
      border: 'border-brand-600/30 dark:border-brand-400/30',
      iconBg: 'bg-brand-600/10',
      iconColor: 'text-brand-600 dark:text-brand-400',
      valueColor: 'text-brand-600 dark:text-brand-400',
    },
    negative: {
      border: 'border-danger-500/30',
      iconBg: 'bg-danger-500/10',
      iconColor: 'text-danger-500',
      valueColor: 'text-danger-500',
    },
  }[accent];

  return (
    <div className={`rounded-xl border ${accentStyles.border} bg-card p-5 transition-colors hover:border-brand-600/20`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          {label}
        </p>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accentStyles.iconBg} ${accentStyles.iconColor}`}>
          <Icon size={15} strokeWidth={2.5} />
        </div>
      </div>
      <p className={`font-display text-2xl font-bold tabular-nums ${accentStyles.valueColor}`}>
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-fg-muted mt-1">{subtext}</p>
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
      <div className="rounded-2xl border border-themed bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-display font-semibold text-fg">Recent Bets</h2>
        </div>
        <div className="py-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-elevated text-fg-muted mb-3">
            <Gamepad2 size={24} />
          </div>
          <p className="text-sm font-medium text-fg">No bets yet</p>
          <p className="text-xs text-fg-muted mt-1">
            Play a game and place your first bet
          </p>
          <Link
            href="/play"
            className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            <Gamepad2 size={15} />
            Find a game
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-themed bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-display font-semibold text-fg">Recent Bets</h2>
        <Link
          href="/bets"
          className="text-sm text-brand-600 dark:text-brand-400 font-semibold hover:underline"
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
  // Determine left border color based on status/outcome
  const isVoided = bet.status === 'VOIDED' || bet.status === 'CANCELLED';
  const isWin = bet.netResult !== null && bet.netResult > 0;
  const isLoss = bet.netResult !== null && bet.netResult < 0;

  let borderClass = 'border-l-themed';
  if (isVoided) borderClass = 'border-l-slate-400 dark:border-l-slate-600';
  else if (isWin) borderClass = 'border-l-brand-500';
  else if (isLoss) borderClass = 'border-l-danger-500';

  // Status badge classes
  let statusClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400';
  if (isVoided) {
    statusClass = 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400';
  } else if (bet.status === 'SETTLED') {
    statusClass = isWin
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400'
      : isLoss
      ? 'bg-danger-50 text-danger-600 dark:bg-danger-950/30 dark:text-danger-400'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400';
  }

  return (
    <Link
      href={`/bets/${bet.id}`}
      className={`flex items-center justify-between p-3 pl-4 rounded-lg border-l-2 ${borderClass} hover:bg-elevated transition-colors`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg truncate">{bet.gameName}</p>
          <p className="text-xs text-fg-muted mt-0.5">
            vs {bet.opponent?.displayName ?? 'Awaiting opponent'} · {formatDate(bet.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusClass}`}>
          {bet.status}
        </span>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-fg">
            {formatCents(bet.amount)}
          </p>
          {bet.netResult !== null && (
            <p
              className={`text-xs font-semibold tabular-nums ${
                bet.netResult > 0
                  ? 'text-brand-600 dark:text-brand-400'
                  : bet.netResult < 0
                  ? 'text-danger-500'
                  : 'text-fg-muted'
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
