import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Learn more | PlayStake',
  description:
    'Learn how PlayStake makes peer-to-peer skill wagering work for competitive gamers.',
};

export default function LearnMorePage() {
  return (
    <div className="min-h-screen bg-ps-paper text-ps-text dark:bg-ps-ink dark:text-ps-text-on-dark">
      <LandingNav />

      <main id="main-content">
        <Hero />
        <MarketStats />
        <HowItWorks />
        <NotBookmaker />
        <GameModes />
        <TrustSection />
        <CommunitySection />
        <BetaSignup />
        <FAQ />
      </main>

      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
