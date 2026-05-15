import { PhoneMockup } from '@/components/ui/PhoneMockup';
import { TrustStrip } from '@/components/ui/TrustStrip';

export function Hero() {
  return (
    <>
      <section
        id="hero"
        className="relative overflow-hidden pt-10 pb-12 sm:pb-16 lg:pt-16 lg:pb-24"
      >
        {/* Ambient glow blobs — decorative */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-48 -left-48 h-[600px] w-[600px] rounded-full"
            style={{ background: 'rgba(34,197,94,0.07)', filter: 'blur(100px)' }}
          />
          <div
            className="absolute top-1/2 -right-40 h-96 w-96 rounded-full"
            style={{ background: 'rgba(6,182,212,0.05)', filter: 'blur(80px)' }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* ── Text column ── */}
            <div className="text-center lg:text-left order-2 lg:order-1">

              {/* Pill badge */}
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-brand-400 animate-fade-up"
                style={{
                  background: 'rgba(34,197,94,0.09)',
                  border: '1px solid rgba(34,197,94,0.22)',
                }}
              >
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute h-full w-full rounded-full bg-brand-400 opacity-75 animate-opponent-pulse" />
                  <span className="relative h-2 w-2 rounded-full bg-brand-400" />
                </span>
                Esports Wagering · Skill vs Skill
              </div>

              {/* H1 */}
              <h1
                className="mt-5 font-display leading-[1.05] tracking-tight text-fg animate-fade-up animate-fade-up-delay-100"
                style={{ fontSize: 'clamp(2.4rem, 5vw, 3.5rem)', fontWeight: 800 }}
              >
                Play for Stakes.
                <span
                  className="block bg-clip-text text-transparent animate-fade-up animate-fade-up-delay-200"
                  style={{
                    backgroundImage: 'linear-gradient(100deg, #22c55e 0%, #06b6d4 100%)',
                  }}
                >
                  Beat Real Players.
                </span>
              </h1>

              {/* Sub-headline */}
              <p className="mt-5 text-base sm:text-[1.0625rem] leading-relaxed text-fg-secondary max-w-lg mx-auto lg:mx-0 animate-fade-up animate-fade-up-delay-200">
                Challenge opponents in competitive gaming matches, stake on your own
                result, and let skill decide the winner.
              </p>

              {/* CTA row */}
              <div
                className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start animate-fade-up animate-fade-up-delay-300"
                role="group"
                aria-label="Primary actions"
              >
                <a
                  href="#beta-signup"
                  className="inline-flex items-center justify-center h-12 min-w-[160px] px-7 rounded-lg bg-brand-500 text-surface-950 font-bold text-sm tracking-wide transition-all btn-glow-hover hover:bg-brand-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950"
                  aria-label="Join the PlayStake beta"
                >
                  Join the Beta
                </a>
                <a
                  href="/how-it-works"
                  className="inline-flex items-center justify-center gap-2 h-12 min-w-[160px] px-7 rounded-lg font-semibold text-sm text-brand-400 transition-all hover:text-brand-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950"
                  style={{ border: '1px solid rgba(34,197,94,0.30)' }}
                  aria-label="See how PlayStake works"
                >
                  See How It Works
                </a>
              </div>

              {/* Proof tags */}
              <div className="mt-8 pt-6 border-t border-themed animate-fade-up animate-fade-up-delay-400">
                <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-fg-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="text-brand-400 font-bold">Skill</span>
                    {' '}not luck
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-brand-400 font-bold">P2P</span>
                    {' '}not the house
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-brand-400 font-bold">Instant</span>
                    {' '}settlement
                  </span>
                </div>
              </div>
            </div>

            {/* ── Phone mockup column ── */}
            <div className="flex justify-center lg:justify-end order-1 lg:order-2 animate-fade-up animate-fade-up-delay-200">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* TrustStrip — directly below hero, full-width bar */}
      <div
        className="border-y border-themed py-4 px-4 sm:px-6 lg:px-8"
        role="complementary"
        aria-label="Trust and safety indicators"
      >
        <TrustStrip />
      </div>
    </>
  );
}
