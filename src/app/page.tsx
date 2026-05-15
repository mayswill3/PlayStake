import { LandingNav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { MarketStats } from '@/components/landing/market-stats';
import { HowItWorks } from '@/components/landing/how-it-works';
import { NotBookmaker } from '@/components/landing/not-bookmaker';
import { GameModes } from '@/components/landing/game-modes';
import { TrustSection } from '@/components/landing/trust-section';
import { CommunitySection } from '@/components/landing/community-section';
import { BetaSignup } from '@/components/landing/beta-signup';
import { FAQ } from '@/components/landing/faq';
import { Footer } from '@/components/layout/Footer';
import { StickyMobileCTA } from '@/components/ui/StickyMobileCTA';

/**
 * Landing page section order:
 *  1. Hero + TrustStrip
 *  2. Market Stats (esports industry context — investor-facing)
 *  3. How It Works (5 steps)
 *  4. Not a Bookmaker (comparison table)
 *  5. Game Modes
 *  6. Trust & Responsible Play
 *  7. Community Layer
 *  8. Beta Signup
 *  9. FAQ
 * 10. Footer
 * 11. StickyMobileCTA (fixed, mobile only)
 */
export default function LandingPage() {
  return (
    <div className="bg-page text-fg min-h-screen">
      <LandingNav />

      <main id="main-content">
        {/* 1. Hero + inline TrustStrip */}
        <Hero />

        {/* 2. Esports market context — investor-facing */}
        <MarketStats />

        {/* 3. How It Works — 5-step match flow */}
        <HowItWorks />

        {/* 4. Not a Bookmaker — P2P comparison table */}
        <NotBookmaker />

        {/* 5. Game Modes — live + coming soon */}
        <GameModes />

        {/* 6. Trust & Responsible Play — pillars */}
        <TrustSection />

        {/* 7. Community Layer */}
        <CommunitySection />

        {/* 8. Beta Signup — name, email, game, player type */}
        <BetaSignup />

        {/* 9. FAQ */}
        <FAQ />
      </main>

      <Footer />

      {/* 11. Sticky bottom CTA — mobile only, hidden at md+ */}
      <StickyMobileCTA />
    </div>
  );
}
