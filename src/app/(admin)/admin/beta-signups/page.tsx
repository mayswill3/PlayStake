'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import {
  BETA_APPLICANT_TYPES,
  BETA_FAVOURITE_GAMES,
} from '@/lib/games/catalogue';
import { UserPlus } from 'lucide-react';

interface BetaSignupItem {
  id: string;
  name: string;
  email: string;
  game: string;
  playerType: string;
  isDemo: boolean;
  consentedAt: string;
  createdAt: string;
}

interface BetaSignupResponse {
  data: BetaSignupItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const applicantVariant = (playerType: string) => {
  switch (playerType) {
    case 'Player':
      return 'success' as const;
    case 'Streamer':
    case 'Partner':
      return 'info' as const;
    case 'Developer':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
};

function formatAdminDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminBetaSignupsPage() {
  const [signups, setSignups] = useState<BetaSignupItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [playerType, setPlayerType] = useState('all');
  const [game, setGame] = useState('all');

  const fetchSignups = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (playerType !== 'all') params.set('playerType', playerType);
      if (game !== 'all') params.set('game', game);

      const response = await fetch(`/api/admin/beta-signups?${params}`);
      if (!response.ok) throw new Error('Failed to load beta signups');

      const body = (await response.json()) as BetaSignupResponse;
      setSignups(body.data);
      setTotal(body.pagination.total);
      setTotalPages(body.pagination.totalPages);
    } catch {
      setError('Failed to load beta signups.');
    } finally {
      setLoading(false);
    }
  }, [game, page, playerType, search]);

  useEffect(() => {
    fetchSignups();
  }, [fetchSignups]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <FadeIn>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Beta Signups
          </h1>
          <p className="mt-1 font-mono text-sm text-text-secondary">
            {total.toLocaleString('en-GB')} early-access{' '}
            {total === 1 ? 'profile' : 'profiles'}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <form onSubmit={handleSearch} className="flex w-full gap-2 sm:w-auto">
            <Input
              type="search"
              placeholder="Search name or email..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <button
              type="submit"
              className="rounded-sm bg-surface-700 px-4 py-2 font-mono text-sm font-medium text-text-primary transition-colors hover:bg-surface-600"
            >
              Search
            </button>
          </form>

          <select
            aria-label="Filter by applicant type"
            value={playerType}
            onChange={(event) => {
              setPlayerType(event.target.value);
              setPage(1);
            }}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--fg)',
            }}
            className="h-10 w-full rounded-lg border px-3 font-mono text-sm focus:border-brand-400 focus:outline-none sm:w-auto"
          >
            <option value="all">All applicant types</option>
            {BETA_APPLICANT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by favourite game"
            value={game}
            onChange={(event) => {
              setGame(event.target.value);
              setPage(1);
            }}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--fg)',
            }}
            className="h-10 w-full rounded-lg border px-3 font-mono text-sm focus:border-brand-400 focus:outline-none sm:w-auto sm:max-w-64"
          >
            <option value="all">All games</option>
            {BETA_FAVOURITE_GAMES.map((gameName) => (
              <option key={gameName} value={gameName}>
                {gameName}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="rounded-sm border border-danger-500/25 bg-danger-500/10 p-4 font-mono text-sm text-danger-400">
            {error}
          </div>
        ) : signups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<UserPlus className="h-10 w-10" />}
              title="No beta signups found"
              description="No early-access applications match the current filters."
            />
          </Card>
        ) : (
          <>
            <Card padding="none" className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/8">
                    <tr>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">
                        Applicant
                      </th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">
                        Type
                      </th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">
                        Favourite Game
                      </th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">
                        Consented
                      </th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {signups.map((signup) => (
                      <tr
                        key={signup.id}
                        className="transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3">
                          <p className="font-mono font-medium text-surface-200">
                            {signup.name}
                          </p>
                          {signup.isDemo ? (
                            <p className="font-mono text-xs text-text-muted">
                              {signup.email}
                            </p>
                          ) : (
                            <a
                              href={`mailto:${signup.email}`}
                              className="font-mono text-xs text-text-muted transition-colors hover:text-brand-400"
                            >
                              {signup.email}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={applicantVariant(signup.playerType)}>
                            {signup.playerType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-text-secondary">
                          {signup.game}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-text-secondary">
                          {signup.isDemo
                            ? 'Not applicable'
                            : formatAdminDate(signup.consentedAt)}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-text-secondary">
                          {formatAdminDate(signup.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-4 pb-4">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </Card>

            <div className="space-y-3 sm:hidden">
              {signups.map((signup) => (
                <Card key={signup.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-surface-200">
                        {signup.name}
                      </p>
                      <p className="mt-0.5 break-all font-mono text-xs text-text-muted">
                        {signup.email}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={applicantVariant(signup.playerType)}>
                        {signup.playerType}
                      </Badge>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs">
                    <div className="col-span-2">
                      <dt className="text-text-muted">Favourite game</dt>
                      <dd className="mt-0.5 text-text-secondary">{signup.game}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Consented</dt>
                      <dd className="mt-0.5 text-text-secondary">
                        {signup.isDemo
                          ? 'Not applicable'
                          : formatAdminDate(signup.consentedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Joined</dt>
                      <dd className="mt-0.5 text-text-secondary">
                        {formatAdminDate(signup.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              ))}
              {totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              )}
            </div>
          </>
        )}
      </div>
    </FadeIn>
  );
}
