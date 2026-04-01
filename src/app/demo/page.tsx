import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Circle, Disc, Grid3x3, Layers, Target } from 'lucide-react';

export default function DemoIndex() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
        Game Demos
      </h1>
      <p className="text-text-secondary font-mono text-sm mb-10">
        See how PlayStake integrates with different game types.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/demo/cards" className="group">
          <Card className="h-full transition-colors group-hover:border-brand-400/30 group-hover:bg-surface-850">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
                <Layers className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-semibold text-text-primary">
                Higher / Lower
              </h2>
            </div>
            <p className="text-sm text-text-secondary font-mono">
              Classic card game with turn-based wagering and score tracking.
            </p>
          </Card>
        </Link>

        <Link href="/demo/tictactoe" className="group">
          <Card className="h-full transition-colors group-hover:border-brand-400/30 group-hover:bg-surface-850">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
                <Grid3x3 className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-semibold text-text-primary">
                Tic-Tac-Toe
              </h2>
            </div>
            <p className="text-sm text-text-secondary font-mono">
              Classic strategy game with two-player wagering and win detection.
            </p>
          </Card>
        </Link>

        <Link href="/demo/pool" className="group">
          <Card className="h-full transition-colors group-hover:border-brand-400/30 group-hover:bg-surface-850">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
                <Circle className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-semibold text-text-primary">
                8-Ball Pool
              </h2>
            </div>
            <p className="text-sm text-text-secondary font-mono">
              Classic 8-ball pool with realistic physics and two-player wagering.
            </p>
          </Card>
        </Link>

        <Link href="/demo/3shot" className="group">
          <Card className="h-full transition-colors group-hover:border-brand-400/30 group-hover:bg-surface-850">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
                <Target className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-semibold text-text-primary">
                3-Shot Pool
              </h2>
            </div>
            <p className="text-sm text-text-secondary font-mono">
              3 shots each. Most balls potted wins. Fast-paced wagered match.
            </p>
          </Card>
        </Link>

        <Link href="/demo/bullseye" className="group">
          <Card className="h-full transition-colors group-hover:border-brand-400/30 group-hover:bg-surface-850">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
                <Disc className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-semibold text-text-primary">
                Bullseye Pool
              </h2>
            </div>
            <p className="text-sm text-text-secondary font-mono">
              Land closest to the target. Win the round. Precision wagered match.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
