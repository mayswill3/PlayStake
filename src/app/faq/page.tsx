import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/legal/LegalPage';
import { FaqList } from '@/components/landing/faq';
import { createPublicMetadata } from '@/lib/seo';
import { FAQ_CATEGORIES } from '@/lib/faq';
import { OpenLinkedAnswer } from './OpenLinkedAnswer';

export const metadata: Metadata = createPublicMetadata({
  title: 'FAQ',
  description:
    'Answers to common questions about PlayStake: who can play, stream challenges, how results are decided, fees, deposits and withdrawals, and safer gambling.',
  path: '/faq',
});

const toc = FAQ_CATEGORIES.map((category) => ({ id: category.id, label: category.title }));

// FAQPage structured data, so search engines can show answers directly.
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  ),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static content from src/lib/faq.ts; escape "<" so it can't close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <OpenLinkedAnswer />
      <LegalPage
        eyebrow="Help"
        title="Frequently asked questions"
        summary="Everything you need to know about playing on PlayStake. Can't find your answer? Email support@playstake.org."
        lastUpdated="30 September 2026"
        toc={toc}
      >
        {FAQ_CATEGORIES.map((category, index) => (
          <LegalSection
            key={category.id}
            id={category.id}
            number={String(index + 1).padStart(2, '0')}
            title={category.title}
          >
            <FaqList items={category.items} />
          </LegalSection>
        ))}
      </LegalPage>
    </>
  );
}
