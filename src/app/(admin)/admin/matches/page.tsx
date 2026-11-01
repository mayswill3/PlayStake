'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Film } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { formatDate } from '@/lib/utils/format';

interface MatchRow {
  id: string;
  status: string;
  amount: string;
  createdAt: string;
  game: string;
  playerA: string;
  playerB: string | null;
  recordings: number;
}

const th = 'px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted';

export default function AdminMatchesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" /></div>}>
      <MatchesList />
    </Suspense>
  );
}

function MatchesList() {
  const params = useSearchParams();
  const userId = params.get('userId');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (userId) qs.set('userId', userId);
      else if (query) qs.set('search', query);
      const res = await fetch(`/api/admin/matches?${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setMatches((await res.json()).matches);
    } catch {
      setError('Failed to load matches.');
    } finally {
      setLoading(false);
    }
  }, [query, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FadeIn>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Matches</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Refereed matches and their recordings. Opening a recording needs a reason, and every viewing is logged.
          </p>
        </div>

        {userId ? (
          <p className="text-sm text-text-secondary">
            Showing one player&apos;s matches. <Link href="/admin/matches" className="text-brand-400 underline">Show all</Link>
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
            className="flex gap-2"
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Player name, email or match ID"
              className="w-full max-w-md rounded-sm border border-surface-700 bg-transparent px-3 py-2 text-sm text-text-primary"
            />
            <button type="submit" className="rounded-sm border border-brand-400/25 bg-brand-400/10 px-4 py-2 text-sm text-brand-400">
              Search
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : error ? (
          <div className="rounded-sm border border-danger-500/25 bg-danger-500/10 p-4 font-mono text-sm text-danger-400">{error}</div>
        ) : matches.length === 0 ? (
          <Card>
            <EmptyState icon={<Film className="h-10 w-10" />} title="No matches found" description="Try another name, email or match ID." />
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/8">
                  <tr>
                    <th className={th}>Date</th>
                    <th className={th}>Game</th>
                    <th className={th}>Players</th>
                    <th className={th}>Stake</th>
                    <th className={th}>Status</th>
                    <th className={th}>Recordings</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => (
                    <tr key={match.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-text-secondary">
                        <Link href={`/admin/matches/${match.id}`} className="text-brand-400 hover:underline">
                          {formatDate(match.createdAt)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-primary">{match.game}</td>
                      <td className="px-4 py-3 text-text-primary">
                        {match.playerA} <span className="text-text-muted">vs</span> {match.playerB ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">£{Number(match.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-[11px] uppercase text-text-secondary">{match.status}</td>
                      <td className="px-4 py-3 text-text-secondary">{match.recordings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </FadeIn>
  );
}
