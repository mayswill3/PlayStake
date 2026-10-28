import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LegalCallout, LegalPage, LegalSection } from '@/components/legal/LegalPage';
import { FaqList } from '@/components/landing/faq';
import { GAME_GUIDES, MATCH_STEPS, gameGuide } from '@/lib/games/guides';
import { SITE_URL, createPublicMetadata } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return GAME_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = gameGuide((await params).slug);
  if (!guide) return {};
  return createPublicMetadata({ title: guide.title, description: guide.description, path: `/games/${guide.slug}` });
}

const toc = [
  { id: 'overview', label: 'Overview' },
  { id: 'how-a-match-works', label: 'How a match works' },
  { id: 'settings', label: 'Standard settings' },
  { id: 'results', label: 'How the result is decided' },
  { id: 'disconnects', label: 'Disconnects' },
  { id: 'stakes', label: 'Stakes and payouts' },
  { id: 'faq', label: 'Questions' },
];

export default async function GameGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = gameGuide((await params).slug);
  if (!guide) notFound();

  const url = `${SITE_URL}/games/${guide.slug}`;
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Games', item: `${SITE_URL}/games` },
        { '@type': 'ListItem', position: 2, name: guide.name, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: guide.faqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // Static content from src/lib/games/guides.ts; escape "<" so it can't close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <LegalPage
        eyebrow={guide.eyebrow}
        title={`${guide.name} on PlayStake`}
        summary={guide.summary}
        lastUpdated="25 October 2026"
        toc={toc}
      >
        <LegalSection id="overview" number="01" title="Overview">
          <div className="relative mb-5 aspect-[16/8] overflow-hidden rounded-xl">
            <Image src={guide.image.src} alt={guide.image.alt} fill sizes="(min-width: 1024px) 720px, 100vw" className="object-cover" />
          </div>
          <ul>
            <li><strong>Format:</strong> {guide.format}.</li>
            <li><strong>Platforms:</strong> {guide.platforms}.</li>
            <li><strong>Who decides:</strong> an independent, approved referee watching both of your Kick streams.</li>
            <li><strong>Rules:</strong> every match is played under our <Link href="/match-rules">Match Rules</Link>.</li>
          </ul>
          <LegalCallout title="Test beta">
            PlayStake is in a test beta. No real-money wagering takes place yet. 21+ only.
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
        </LegalSection>

        <LegalSection id="settings" number="03" title="Standard settings">
          <p>
            Agree your settings on stream before the referee starts the match. If you don&apos;t agree
            anything, these apply:
          </p>
          <ul>
            {guide.standardSettings.map((setting) => (
              <li key={setting.label}>
                <strong>{setting.label}:</strong> {setting.value}.
              </li>
            ))}
          </ul>
        </LegalSection>

        <LegalSection id="results" number="04" title="How the result is decided">
          <ul>
            {guide.howDecided.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>
              Either player can dispute the result within 15 minutes. Our team reviews both streams,
              match chat and the referee&apos;s notes before anything is paid out.
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="disconnects" number="05" title="Disconnects">
          <p>
            Reconnect as quickly as you can and say what happened on your stream. The referee decides
            what&apos;s fair from what both streams show. Usually:
          </p>
          <ul>
            {guide.disconnects.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </LegalSection>

        <LegalSection id="stakes" number="06" title="Stakes and payouts">
          <ul>
            <li>Stakes from £1 to £500, matched by both players. Nothing is taken until the challenge is accepted.</li>
            <li>The winner receives the pot less a 5% platform fee. For example, £10 each makes a £20 pot, and the winner receives £19.</li>
            <li>A draw returns each player&apos;s stake, less their share of the fee.</li>
            <li>
              Set deposit limits, take a break or self-exclude any time from{' '}
              <Link href="/faq#tools">Safer Gambling</Link>.
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="faq" number="07" title="Questions">
          <FaqList items={guide.faqs} />
          <p className="mt-4">
            More answers in the <Link href="/faq">FAQ</Link>, or see{' '}
            <Link href="/games">all games</Link>.
          </p>
        </LegalSection>
      </LegalPage>
    </>
  );
}
