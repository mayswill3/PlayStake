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
import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'How PlayStake Works',
  description:
    'Explore PlayStake’s player-versus-player challenges, protected stakes, live Kick integration, referee oversight, supported games, and responsible-play features.',
  path: '/learn-more',
});

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
