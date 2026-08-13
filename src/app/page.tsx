import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { BetaSignup } from '@/components/landing/beta-signup';
import { GameModes } from '@/components/landing/game-modes';
import { TrustSection } from '@/components/landing/trust-section';
import { FAQ } from '@/components/landing/faq';
import { Footer } from '@/components/layout/Footer';
import { StickyMobileCTA } from '@/components/ui/StickyMobileCTA';
import {
  createPublicMetadata,
  DEFAULT_SEO_DESCRIPTION,
  SOCIAL_PROFILES,
  SITE_URL,
} from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'PlayStake | Skill-Based Player-vs-Player Gaming',
  description: DEFAULT_SEO_DESCRIPTION,
  path: '/',
  absoluteTitle: true,
});

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: 'PlayStake',
      alternateName: 'Play Stake',
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'PlayStake',
      url: `${SITE_URL}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
        width: 200,
        height: 200,
      },
      description: DEFAULT_SEO_DESCRIPTION,
      sameAs: [SOCIAL_PROFILES.instagram, SOCIAL_PROFILES.tiktok],
    },
  ],
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ps-paper text-ps-text dark:bg-ps-ink dark:text-ps-text-on-dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />

      <LandingNav />

      <main id="main-content">
        <Hero />
        <HowItWorks />
        <BetaSignup />
        <GameModes />
        <TrustSection />
        <FAQ />
      </main>

      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
