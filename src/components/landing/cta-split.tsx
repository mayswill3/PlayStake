import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CtaSplit() {
  return (
    <section className="py-20 lg:py-28 bg-elevated">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Player CTA */}
          <div className="rounded-2xl bg-brand-600 text-white p-8 lg:p-10 flex flex-col">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-3">
              I&apos;m a player
            </div>
            <h3 className="font-display text-3xl lg:text-4xl font-bold leading-tight">
              Start winning money playing games today.
            </h3>
            <p className="mt-4 text-white/80 text-base lg:text-lg">
              Create your account in seconds, fund your wallet, and challenge anyone to a match with real stakes.
            </p>
            <Link
              href="/register"
              className="mt-auto inline-flex items-center justify-center gap-2 h-12 px-6 mt-8 rounded-lg bg-white text-brand-700 font-semibold hover:bg-white/95 active:scale-[0.98] transition-all w-fit"
            >
              Get Started
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Developer CTA */}
          <div
            className="rounded-2xl p-8 lg:p-10 flex flex-col text-white"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-3">
              I&apos;m a developer
            </div>
            <h3 className="font-display text-3xl lg:text-4xl font-bold leading-tight">
              Integrate today and earn revenue share on every bet.
            </h3>
            <p className="mt-4 text-white/70 text-base lg:text-lg">
              Drop in the widget, pass your game ID, and start earning a share of every wager placed in your game.
            </p>
            <Link
              href="/developer"
              className="mt-auto inline-flex items-center justify-center gap-2 h-12 px-6 mt-8 rounded-lg bg-white text-slate-900 font-semibold hover:bg-white/95 active:scale-[0.98] transition-all w-fit"
            >
              Developer Portal
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
