import { EyebrowPill, PhoneMockup, PSButton } from '@/components/ui/playstake';
import { TrustStrip } from '@/components/ui/TrustStrip';

export function Hero() {
  return (
    <>
      <section
        id="hero"
        className="relative overflow-hidden bg-ps-paper dark:bg-ps-ink pt-10 pb-12 sm:pb-16 lg:pt-16 lg:pb-24"
      >
        {/* Ambient glow blobs — decorative */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-48 -left-48 h-[600px] w-[600px] rounded-full"
            style={{ background: 'var(--ps-lime-20)', filter: 'blur(120px)' }}
          />
          <div
            className="absolute top-1/2 -right-40 h-96 w-96 rounded-full"
            style={{ background: 'var(--ps-cyan-10)', filter: 'blur(100px)' }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Text column */}
            <div className="text-center lg:text-left order-2 lg:order-1">

              {/* Eyebrow pill */}
              <EyebrowPill label="SKILL-BASED ESPORTS WAGERING" className="mb-5" />

              {/* H1 */}
              <h1
                className="font-display leading-[1.05] tracking-tight text-ps-text dark:text-ps-text-on-dark"
                style={{ fontSize: 'clamp(2.4rem, 5vw, 3.5rem)', fontWeight: 800 }}
              >
                Play for Stakes.
                <span className="block ps-gradient-text">
                  Beat Real Players.
                </span>
              </h1>

              {/* Sub-headline */}
              <p className="mt-5 text-base sm:text-[1.0625rem] leading-relaxed text-ps-muted dark:text-ps-muted-on-dark max-w-md mx-auto lg:mx-0">
                Challenge opponents in competitive gaming matches, stake on your own
                result, and let skill decide the winner.
              </p>

              {/* CTA row */}
              <div
                className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
                role="group"
                aria-label="Primary actions"
              >
                <a href="#beta-signup">
                  <PSButton size="lg" className="w-full sm:w-auto min-w-[160px]">
                    Join the Beta
                  </PSButton>
                </a>
                <a href="/how-it-works">
                  <PSButton variant="secondary" size="lg" className="w-full sm:w-auto min-w-[160px]">
                    See How It Works
                  </PSButton>
                </a>
              </div>

              {/* Proof tags */}
              <div className="mt-8 pt-6 border-t border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
                <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-ps-muted dark:text-ps-muted-on-dark">
                  <span className="flex items-center gap-1.5">
                    <span className="text-ps-lime font-bold">Skill</span>
                    {' '}not luck
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-ps-lime font-bold">P2P</span>
                    {' '}not the house
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-ps-lime font-bold">Instant</span>
                    {' '}settlement
                  </span>
                </div>
              </div>
            </div>

            {/* Phone mockup column */}
            <div className="flex justify-center lg:justify-end order-1 lg:order-2">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* TrustStrip — directly below hero, full-width bar */}
      <div
        className="border-y border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-white/60 dark:bg-ps-ink-2 py-4 px-4 sm:px-6 lg:px-8"
        role="complementary"
        aria-label="Trust and safety indicators"
      >
        <TrustStrip />
      </div>
    </>
  );
}
