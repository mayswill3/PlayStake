import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalCallout,
  LegalPage,
  LegalSection,
  LegalTable,
} from '@/components/legal/LegalPage';
import { createPublicMetadata } from '@/lib/seo';
import { ComplaintForm } from './ComplaintForm';

export const metadata: Metadata = createPublicMetadata({
  title: 'Complaints Procedure',
  description:
    'How to make a complaint to PlayStake, how we handle it, when you will hear from us, and how to take it to IBAS, our independent dispute resolution service.',
  path: '/complaints',
});

const toc = [
  { id: 'make-a-complaint', label: 'Make a complaint' },
  { id: 'what-happens', label: 'What happens next' },
  { id: 'adr', label: 'If you are not satisfied: IBAS' },
  { id: 'disputes', label: 'Complaints and result disputes' },
  { id: 'other-routes', label: 'Other organisations' },
  { id: 'form', label: 'Complaint form' },
];

export default function ComplaintsPage() {
  return (
    <LegalPage
      eyebrow="Help"
      title="Complaints Procedure"
      summary="If something has gone wrong, we want to put it right. This page explains how to complain, how we deal with it, how long it takes, and the free independent service you can use if you are not happy with our answer."
      lastUpdated="30 September 2026"
      toc={toc}
    >
      <LegalSection id="make-a-complaint" number="01" title="Make a complaint">
        <p>
          You can complain about anything to do with PlayStake: your account, a payment or
          withdrawal, a bet or its result, a referee, how we have treated you, or how we
          handled an earlier dispute.
        </p>
        <ul>
          <li>
            <strong>Online:</strong> use the <a href="#form">complaint form</a> at the bottom of
            this page. You do not need to be signed in.
          </li>
          <li>
            <strong>By email:</strong> write to{' '}
            <a href="mailto:support@playstake.org">support@playstake.org</a> with your
            name, the email address on your account and what went wrong.
          </li>
        </ul>
        <p>
          Tell us what happened, when, and what you would like us to do. If it is about a
          particular bet, include the bet link or ID. Making a complaint is free.
        </p>
      </LegalSection>

      <LegalSection id="what-happens" number="02" title="What happens next">
        <LegalTable
          headers={['Stage', 'What we do', 'When']}
          rows={[
            ['Acknowledgement', 'We email you a complaint reference (PS-C-…). Please quote it in any reply.', 'Straight away'],
            ['Investigation', 'A member of our team reviews your account, the transaction or match records, stream footage and referee evidence, and may ask you for more information.', 'As soon as possible'],
            ['Final response', 'We write to you with our decision, the reasons for it, and what we will do to put things right if your complaint is upheld.', 'Within 8 weeks of receiving it — usually much sooner'],
          ]}
        />
        <p>
          If a bet or balance is involved, the funds stay protected while we investigate. We
          keep a record of every complaint and its outcome.
        </p>
      </LegalSection>

      <LegalSection id="adr" number="03" title="If you are not satisfied: IBAS">
        <p>
          If you are unhappy with our final response, or we have not sent you one within
          eight weeks, you can refer your complaint to our alternative dispute resolution
          (ADR) provider:
        </p>
        <LegalCallout title="IBAS — Independent Betting Adjudication Service">
          <p>
            IBAS is independent of PlayStake and approved by the Gambling Commission to
            resolve disputes between gambling businesses and their customers. It is{' '}
            <strong>free for you to use</strong>. Start a referral at{' '}
            <a href="https://www.ibas-uk.com" target="_blank" rel="noreferrer">
              www.ibas-uk.com
            </a>
            , normally within six months of our final response.
          </p>
        </LegalCallout>
        <p>
          IBAS will ask for your complaint reference and our final response, so keep our
          emails. Its decision is binding on us if you accept it.
        </p>
      </LegalSection>

      <LegalSection id="disputes" number="04" title="Complaints and result disputes">
        <p>
          If you think a <strong>match result</strong> is wrong, use the dispute button on the
          bet page within the time shown there — it is the quickest way to get a result
          reviewed, and payout pauses while we look. If you are unhappy with how a dispute
          was decided or handled, you can then raise a complaint here.
        </p>
      </LegalSection>

      <LegalSection id="other-routes" number="05" title="Other organisations">
        <ul>
          <li>
            The <strong>Gambling Commission</strong> regulates gambling in Great Britain. It
            cannot resolve individual complaints, but you can tell it about your concerns at{' '}
            <a href="https://www.gamblingcommission.gov.uk" target="_blank" rel="noreferrer">
              gamblingcommission.gov.uk
            </a>
            .
          </li>
          <li>
            For complaints about how we handle your personal data, see our{' '}
            <Link href="/privacy">Privacy Policy</Link>; you can also contact the Information
            Commissioner&rsquo;s Office.
          </li>
          <li>
            If gambling is causing you problems, free, confidential support is available from
            GamCare on 0808 8020 133 and at{' '}
            <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer">
              BeGambleAware
            </a>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="form" number="06" title="Complaint form">
        <ComplaintForm />
      </LegalSection>
    </LegalPage>
  );
}
