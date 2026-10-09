import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/nav';
import { Footer } from '@/components/layout/Footer';
import { DemoVideoProvider } from '@/components/home/DemoVideo';
import { HomeHero } from '@/components/home/HomeHero';
import {
  CostsAndControl,
  FindYourGame,
  MatchExperience,
  RefereeReview,
  SimpleWayToPlay,
} from '@/components/home/HomeSections';
import { JoinBeta } from '@/components/home/JoinBeta';
import {
  createPublicMetadata,
  DEFAULT_SEO_DESCRIPTION,
  SOCIAL_PROFILES,
  SITE_URL,
} from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'PlayStake | Your game. Head to head.',
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
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 200, height: 200 },
      description: DEFAULT_SEO_DESCRIPTION,
      sameAs: [SOCIAL_PROFILES.instagram, SOCIAL_PROFILES.tiktok],
    },
  ],
};

const HOME_LINKS = [
  { href: '#games', label: 'Games' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '/fair-play', label: 'Fair play' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ps-paper text-ps-text dark:bg-ps-ink dark:text-ps-text-on-dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <LandingNav links={HOME_LINKS} ctaHref="#join" ctaLabel="Join the beta" />
      <DemoVideoProvider>
        <main id="main-content">
          <HomeHero />
          <FindYourGame />
          <SimpleWayToPlay />
          <RefereeReview />
          <CostsAndControl />
          <MatchExperience />
          <JoinBeta />
        </main>
      </DemoVideoProvider>
      <Footer />
    </div>
  );
}
