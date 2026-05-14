import { LandingNav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
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
 * Landing page — always rendered in dark (esports) mode via `force-dark`.
 * The `force-dark` wrapper pins all CSS variable tokens to their dark values
 * regardless of the user's system/theme preference, keeping the esports
 * visual identity consistent for all visitors.
 *
 * Section order:
 *  1. Hero + TrustStrip
 *  2. How It Works (5 steps)
 *  3. Not a Bookmaker (comparison table)
 *  4. Game Modes
 *  5. Trust & Responsible Play
 *  6. Community Layer
 *  7. Beta Signup
 *  8. FAQ
 *  9. Footer
 * 10. StickyMobileCTA (fixed, mobile only)
 */
export default function LandingPage() {
  return (
    <div className="bg-page text-fg min-h-screen">
      <LandingNav />

      <main id="main-content">
        {/* 1. Hero + inline TrustStrip */}
        <Hero />

        {/* 2. How It Works — 5-step match flow */}
        <HowItWorks />

        {/* 3. Not a Bookmaker — P2P comparison table */}
        <NotBookmaker />

        {/* 4. Game Modes — live + coming soon */}
        <GameModes />

        {/* 5. Trust & Responsible Play — pillars */}
        <TrustSection />

        {/* 6. Community Layer */}
        <CommunitySection />

        {/* 7. Beta Signup — name, email, game, player type */}
        <BetaSignup />

        {/* 8. FAQ */}
        <FAQ />
      </main>

      <Footer />

      {/* 10. Sticky bottom CTA — mobile only, hidden at md+ */}
      <StickyMobileCTA />
    </div>
  );
}
