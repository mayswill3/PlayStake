import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { MarketStats } from '@/components/landing/market-stats';
import { NotBookmaker } from '@/components/landing/not-bookmaker';
import { HowItWorks } from '@/components/landing/how-it-works';
import { BetaSignup } from '@/components/landing/beta-signup';
import { GameModes } from '@/components/landing/game-modes';
import { TrustSection } from '@/components/landing/trust-section';
import { ForReferees } from '@/components/landing/for-referees';
import { FAQ } from '@/components/landing/faq';
import { Footer } from '@/components/layout/Footer';
import { StickyMobileCTA } from '@/components/ui/StickyMobileCTA';
import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'PlayStake for Investors and Partners',
  description:
    'The PlayStake opportunity: peer-to-peer skill wagering on live stream matches, the market, how it works, and how we keep it fair and safe.',
  path: '/investors',
});


export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-ps-paper text-ps-text dark:bg-ps-ink dark:text-ps-text-on-dark">

      <LandingNav />

      <main id="main-content">
        <Hero />
        <MarketStats />
        <HowItWorks />
        <NotBookmaker />
        <BetaSignup />
        <GameModes />
        <TrustSection />
        <FAQ />
        <ForReferees />
      </main>

      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
