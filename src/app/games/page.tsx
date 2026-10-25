import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { LegalCallout, LegalPage, LegalSection } from '@/components/legal/LegalPage';
import { GAME_GUIDES, MATCH_STEPS } from '@/lib/games/guides';
import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'Games: EA SPORTS FC 27 and Tekken 8 Head-to-Head Matches',
  description:
    'The games you can play head to head on PlayStake: EA SPORTS FC 27 and Tekken 8. Both players stream on Kick and an independent referee records the result.',
  path: '/games',
});

const toc = [
  { id: 'games', label: 'Games' },
  { id: 'how-a-match-works', label: 'How a match works' },
];

export default function GamesPage() {
  return (
    <LegalPage
      eyebrow="Games"
      title="Games on PlayStake"
      summary="Two games, played head to head. Both players stream on Kick and an independent referee watches both streams and records the result."
      lastUpdated="25 October 2026"
      toc={toc}
    >
      <LegalSection id="games" number="01" title="Games">
        <div className="not-prose grid gap-4 sm:grid-cols-2">
          {GAME_GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/games/${guide.slug}`}
              className="group overflow-hidden rounded-xl border border-[var(--ps-border-light)] transition-colors hover:border-[var(--ps-lime)] dark:border-[var(--ps-border-dark)]"
            >
              <div className="relative aspect-[16/9]">
                <Image src={guide.image.src} alt={guide.image.alt} fill sizes="(min-width: 640px) 360px, 100vw" className="object-cover" />
              </div>
              <div className="p-4">
                <p className="font-display text-lg font-bold text-ps-text dark:text-ps-text-on-dark">{guide.name}</p>
                <p className="mt-1 text-sm">{guide.format}.</p>
                <p className="mt-2 text-sm font-semibold text-ps-text underline underline-offset-2 group-hover:text-ps-lime dark:text-ps-text-on-dark">
                  How {guide.name} matches work
                </p>
              </div>
            </Link>
          ))}
        </div>
        <LegalCallout title="Test beta">
          PlayStake is in a test beta. No real-money wagering takes place yet. 18+ only.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="how-a-match-works" number="02" title="How a match works">
        <ol>
          {MATCH_STEPS.map((step) => (
            <li key={step.title}>
              <strong>{step.title}.</strong> {step.body}
            </li>
          ))}
        </ol>
        <p>
          Every match is played under our <Link href="/match-rules">Match Rules</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
