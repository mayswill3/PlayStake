import { LandingNav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { ForPlayers } from '@/components/landing/for-players';
import { StatsSection } from '@/components/landing/stats-section';
import { CtaSplit } from '@/components/landing/cta-split';
import { Footer } from '@/components/layout/Footer';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-page text-fg">
      <LandingNav />
      <Hero />
      <HowItWorks />
      <ForPlayers />
<StatsSection />
      <CtaSplit />
      <Footer />
    </main>
  );
}
