import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalCallout,
  LegalPage,
  LegalSection,
} from '@/components/legal/LegalPage';
import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'Terms of Service',
  description:
    'Read the terms governing PlayStake accounts, player challenges, protected stakes, live streaming, referees, disputes, payments, and responsible use.',
  path: '/terms',
});

const toc = [
  { id: 'about', label: 'About these Terms' },
  { id: 'service-status', label: 'Service and regulatory status' },
  { id: 'eligibility', label: 'Eligibility and verification' },
  { id: 'accounts', label: 'Accounts and security' },
  { id: 'challenges', label: 'Challenges and stakes' },
  { id: 'streaming', label: 'Streaming and Kick' },
  { id: 'referees', label: 'Referees and evidence' },
  { id: 'payments', label: 'Payments, fees and withdrawals' },
  { id: 'disputes', label: 'Results and disputes' },
  { id: 'responsible-play', label: 'Responsible play' },
  { id: 'prohibited-use', label: 'Prohibited conduct' },
  { id: 'suspension', label: 'Suspension and closure' },
  { id: 'intellectual-property', label: 'Intellectual property' },
  { id: 'availability', label: 'Availability and liability' },
  { id: 'changes', label: 'Changes and termination' },
  { id: 'law', label: 'Governing law' },
  { id: 'contact', label: 'Contact' },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      summary="These Terms explain the rules for using PlayStake, entering player-versus-player challenges, connecting a live stream, and taking part as a player or referee."
      lastUpdated="6 August 2026"
      toc={toc}
    >
      <LegalCallout title="Important beta and licensing notice" tone="warning">
        <p>
          PlayStake does not currently hold a gambling licence. Real-money play
          is not available for general public use unless and until the relevant
          service is legally authorised. During beta testing, balances,
          deposits and stakes may use test funds and may not be withdrawable.
        </p>
      </LegalCallout>

      <LegalSection id="about" number="01" title="About these Terms">
        <p>
          These Terms form an agreement between you and PlayStake Ltd
          (&ldquo;PlayStake&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or
          &ldquo;our&rdquo;) when you access playstake.org, create an account,
          use the PlayStake software, or participate in a challenge, stream or
          referee programme.
        </p>
        <p>
          By using PlayStake, you confirm that you have read and accepted these
          Terms and our <Link href="/privacy">Privacy Policy</Link>. If you do
          not agree, do not create an account or use the service.
        </p>
      </LegalSection>

      <LegalSection
        id="service-status"
        number="02"
        title="Service and regulatory status"
      >
        <p>
          PlayStake provides technology for skill-based, player-versus-player
          challenges, match administration, streaming integrations, protected
          balances, result verification and dispute handling. PlayStake does
          not take the opposing side of a player&rsquo;s challenge.
        </p>
        <p>
          Whether a particular activity is permitted depends on its structure
          and the laws where each participant is located. We may restrict,
          suspend or decline access to any feature or territory to meet legal,
          payment-provider, safety or licensing requirements.
        </p>
        <p>
          A feature shown in the interface is not a promise that it is available
          in your location or enabled for real-money use. We will identify test
          or promotional balances where applicable.
        </p>
      </LegalSection>

      <LegalSection
        id="eligibility"
        number="03"
        title="Eligibility and verification"
      >
        <p>You may use PlayStake only if:</p>
        <ul>
          <li>you are at least 18 years old;</li>
          <li>you have legal capacity to enter a binding agreement;</li>
          <li>
            your use is lawful in every place from which you access the service;
          </li>
          <li>
            you are not self-excluded, prohibited, sanctioned or otherwise
            restricted from taking part; and
          </li>
          <li>the account is for you and not another person.</li>
        </ul>
        <p>
          Before enabling deposits, withdrawals or staked play, we may require
          identity, age, address, payment-method, source-of-funds or other
          verification. We will explain what is required and why. You must
          provide accurate, current information and promptly correct changes.
        </p>
        <p>
          We will not treat a failure to complete verification as permission to
          confiscate an undisputed deposit balance. We may restrict activity
          while checks are completed and return funds through an appropriate
          payment method, subject to law, fraud prevention and financial-crime
          obligations.
        </p>
      </LegalSection>

      <LegalSection id="accounts" number="04" title="Accounts and security">
        <p>
          You may maintain one personal player account unless we approve
          another account for a separate developer or administrative purpose.
          Your login credentials, authentication device and linked accounts
          must be kept secure.
        </p>
        <p>
          You are responsible for activity authorised through your account
          unless it results from our failure to use reasonable care. Contact us
          immediately if you suspect unauthorised access. We may invalidate
          sessions, require a password change or temporarily secure an account
          when necessary.
        </p>
        <p>
          Display names, profile images and other public profile material must
          not impersonate others, infringe rights, contain unlawful material or
          be abusive or misleading.
        </p>
      </LegalSection>

      <LegalSection
        id="challenges"
        number="05"
        title="Challenges and protected stakes"
      >
        <p>
          Before accepting a challenge, each player should review the opponent,
          game, stake, currency, fees, referee method, time limits and any
          game-specific rules shown in the confirmation flow.
        </p>
        <p>
          A challenge becomes binding only after both players give the required
          consent and the system confirms that the stakes have been reserved.
          Until then, a challenge may expire, be declined or be cancelled as
          indicated in the interface.
        </p>
        <p>
          Reserved stakes cannot normally be spent or withdrawn while a match
          is active. They will be settled, refunded or held for review according
          to the verified result, cancellation rules and dispute process.
          Attempts to manipulate a match, result or payment may result in the
          stake being held while an investigation is completed.
        </p>
      </LegalSection>

      <LegalSection id="streaming" number="06" title="Streaming and Kick">
        <p>
          If you connect Kick, you authorise PlayStake to access the account and
          channel information covered by the permissions you approve, including
          live status and channel details. You can disconnect Kick through
          PlayStake settings, although Kick may require separate revocation.
        </p>
        <p>
          Players in stream-versus-stream challenges must connect their own
          Kick accounts, accurately declare the game being played, and ensure
          their streams give the assigned referee a reasonable view of the
          match. Stream delay, interruption, missing footage or a materially
          different game may lead to a pause, void result or dispute.
        </p>
        <p>
          Your use of Kick remains subject to Kick&rsquo;s own terms. PlayStake
          is an independent service and is not endorsed by or affiliated with
          Kick.
        </p>
      </LegalSection>

      <LegalSection
        id="referees"
        number="07"
        title="Referees, evidence and audit records"
      >
        <p>
          Some matches use automated validation, a human referee or both. A
          human referee may watch both authorised streams, review relevant game
          information and submit a decision. Referees must be impartial, keep
          information confidential, disclose conflicts and avoid any financial
          interest in the match.
        </p>
        <p>
          Material referee actions are recorded in an audit trail. Players agree
          that authorised match information, stream content, game events,
          result records and dispute submissions may be reviewed for settlement,
          fraud prevention and appeals.
        </p>
        <p>
          Referee compensation, where available, is the amount shown before an
          assignment is accepted. Unless expressly stated otherwise, it is paid
          from the disclosed platform fee rather than deducted from the
          players&rsquo; advertised prize pot.
        </p>
      </LegalSection>

      <LegalSection
        id="payments"
        number="08"
        title="Payments, fees and withdrawals"
      >
        <p>
          Payment services may be provided by a third-party payment processor.
          We do not normally receive full card details. Deposits and withdrawals
          may be delayed or rejected by the payment processor, your bank,
          verification checks, transaction monitoring or applicable law.
        </p>
        <p>
          All fees and exchange-rate effects that PlayStake controls will be
          shown before you confirm the relevant transaction or challenge.
          Platform, developer and referee fees are recorded in the transaction
          history where applicable.
        </p>
        <p>
          You must use payment methods you are authorised to use. Chargebacks,
          reversals or payment disputes made dishonestly may cause balances to
          be corrected and the account to be restricted while the matter is
          investigated.
        </p>
        <p>
          A displayed balance is not a bank deposit and does not earn interest.
          Test, bonus or promotional funds may be non-withdrawable where that
          status is clearly stated before use.
        </p>
      </LegalSection>

      <LegalSection id="disputes" number="09" title="Results and disputes">
        <p>
          Players must report results honestly and respond within any deadline
          displayed in the match. If both players confirm a result, or a
          challenge reaches an applicable confirmation deadline without a
          dispute, the system may settle it automatically.
        </p>
        <p>
          If you believe a result is wrong, use the in-product dispute control
          within the stated deadline and provide a clear reason and relevant
          evidence. Funds may remain reserved while the dispute is reviewed.
          PlayStake may consider game data, stream footage, audit records,
          referee evidence, player submissions and technical logs.
        </p>
        <p>
          We will communicate the outcome through the account where practical.
          We may correct, uphold, reverse or void a result. Nothing in this
          section removes any mandatory complaint or consumer rights available
          under applicable law.
        </p>
      </LegalSection>

      <LegalSection
        id="responsible-play"
        number="10"
        title="Responsible play"
      >
        <p>
          Only participate with money you can afford to lose. Do not use borrowed
          money, chase losses or play when participation is affecting your
          finances, health or relationships.
        </p>
        <p>
          We may introduce deposit limits, activity limits, time-outs and
          self-exclusion controls. Where a restriction is active, you must not
          attempt to bypass it with another account or identity. If you need
          confidential support, visit{' '}
          <a
            href="https://www.begambleaware.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            BeGambleAware
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection
        id="prohibited-use"
        number="11"
        title="Prohibited conduct"
      >
        <p>You must not:</p>
        <ul>
          <li>cheat, collude, fix results or submit fabricated evidence;</li>
          <li>
            use multiple accounts, another person&rsquo;s identity or an
            unauthorised payment method;
          </li>
          <li>
            exploit bugs, interfere with game events, reverse engineer security
            controls or access another user&rsquo;s data;
          </li>
          <li>
            use bots or automation unless a published developer interface
            expressly allows it;
          </li>
          <li>
            threaten, harass, discriminate against or improperly influence
            players, referees or staff;
          </li>
          <li>
            launder money, evade sanctions, conceal the source of funds or use
            PlayStake for unlawful activity; or
          </li>
          <li>
            circumvent an age, location, account, responsible-play or regulatory
            restriction.
          </li>
        </ul>
        <p>
          You should report suspected manipulation through the dispute process
          or to our support contact rather than attempting to investigate or
          retaliate yourself.
        </p>
      </LegalSection>

      <LegalSection
        id="suspension"
        number="12"
        title="Suspension, investigations and account closure"
      >
        <p>
          We may restrict or suspend an account where reasonably necessary to
          protect users, investigate suspected misconduct, secure an account,
          comply with law or meet a provider requirement. Where permitted, we
          will explain the general reason and provide a way to contact us.
        </p>
        <p>
          You may ask to close your account. Closure does not cancel unresolved
          challenges, payment obligations, disputes, investigations or records
          we must retain. Subject to lawful holds and verification, we will make
          undisputed withdrawable funds available or return them using an
          appropriate method.
        </p>
      </LegalSection>

      <LegalSection
        id="intellectual-property"
        number="13"
        title="Intellectual property and user content"
      >
        <p>
          PlayStake and its licensors own the platform software, branding,
          interfaces and original content. We grant you a limited, revocable,
          non-transferable right to use the service for its intended purpose.
        </p>
        <p>
          You retain ownership of content you submit. You grant PlayStake a
          limited licence to host, reproduce, display and process that content
          as necessary to operate the service, administer matches, investigate
          disputes, protect users and comply with law.
        </p>
        <p>
          Third-party games, streams, logos and services remain the property of
          their respective owners.
        </p>
      </LegalSection>

      <LegalSection
        id="availability"
        number="14"
        title="Availability, warranties and liability"
      >
        <p>
          PlayStake is under active development. We do not promise uninterrupted
          availability or that every third-party stream, payment or game
          integration will always work. We will use reasonable care and skill in
          providing the service.
        </p>
        <p>
          Nothing in these Terms excludes liability that cannot lawfully be
          excluded, including liability for fraud, fraudulent misrepresentation,
          death or personal injury caused by negligence, or your statutory
          consumer rights.
        </p>
        <p>
          To the extent permitted by law, PlayStake is not responsible for
          indirect or unforeseeable loss, third-party service failures, or loss
          caused by your breach, unauthorised account sharing or unlawful use.
          Any further limitation must be interpreted fairly and consistently
          with mandatory consumer law.
        </p>
      </LegalSection>

      <LegalSection
        id="changes"
        number="15"
        title="Changes to the service or these Terms"
      >
        <p>
          We may change the service and these Terms as the product, law or
          regulatory requirements develop. For material changes, we will provide
          reasonable notice through the service, by email or both, unless an
          urgent security or legal change requires faster action.
        </p>
        <p>
          The date at the top shows the latest revision. Continued use after a
          notified change takes effect means you accept the updated Terms. If
          you do not accept them, stop using the service and request account
          closure.
        </p>
      </LegalSection>

      <LegalSection id="law" number="16" title="Governing law">
        <p>
          These Terms are governed by the laws of England and Wales. If you are
          a consumer, you retain any mandatory protections and rights to bring a
          claim in the courts available under the law of your usual residence.
          Nothing here prevents the parties from trying to resolve a complaint
          informally first.
        </p>
      </LegalSection>

      <LegalSection id="contact" number="17" title="Contact us">
        <p>
          Questions, complaints or notices about these Terms can be sent to
          PlayStake Ltd at{' '}
          <a href="mailto:support@playstake.org">support@playstake.org</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
