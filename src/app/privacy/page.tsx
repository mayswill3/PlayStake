import type { Metadata } from 'next';
import {
  LegalCallout,
  LegalPage,
  LegalSection,
  LegalTable,
} from '@/components/legal/LegalPage';
import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'Privacy Policy',
  description:
    'Learn what personal information PlayStake collects, why it is used, who it is shared with, how long it is retained, and the choices and rights available to users.',
  path: '/privacy',
});

const toc = [
  { id: 'scope', label: 'Who we are and scope' },
  { id: 'data', label: 'Information we collect' },
  { id: 'sources', label: 'Where information comes from' },
  { id: 'uses', label: 'How and why we use it' },
  { id: 'automated', label: 'Automated match decisions' },
  { id: 'sharing', label: 'Who receives information' },
  { id: 'transfers', label: 'International transfers' },
  { id: 'retention', label: 'How long we keep it' },
  { id: 'cookies', label: 'Cookies and local storage' },
  { id: 'security', label: 'Security' },
  { id: 'rights', label: 'Your rights' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'children', label: 'Children' },
  { id: 'changes', label: 'Changes and contact' },
];

const dataRows = [
  [
    <strong key="account">Account and profile</strong>,
    'Email address, display name, password hash, avatar, verification status, role, account settings and last-login time.',
  ],
  [
    <strong key="linked">Linked services</strong>,
    'Google identity details when you use Google sign-in; Kick user ID, email where provided, channel slug, display name, profile image, live status, declared game, approved permissions and encrypted access credentials.',
  ],
  [
    <strong key="payments">Payments and balances</strong>,
    'Stripe customer and payment identifiers, deposit and withdrawal status, amounts, currency, ledger entries, fees, reversals and transaction history. PlayStake does not normally receive your complete card number.',
  ],
  [
    <strong key="matches">Matches and disputes</strong>,
    'Challenges, opponents, games, stakes, consent, results, game events, technical result hashes, dispute reasons, messages, evidence and settlement information.',
  ],
  [
    <strong key="referee">Referee information</strong>,
    'Application status, availability, qualifications, biography, assignments, decisions, evidence, performance record and append-only audit events.',
  ],
  [
    <strong key="technical">Device and security</strong>,
    'IP address, hashed IP in referee audit records, user agent, session token hash, cookie identifiers, timestamps, failed-login and rate-limit information, and security or anomaly alerts.',
  ],
  [
    <strong key="developer">Developer information</strong>,
    'Company name, website, contact email, registered games, API-key metadata, webhook configuration and delivery logs.',
  ],
  [
    <strong key="support">Communications</strong>,
    'Messages and information you send when contacting support, reporting a problem, applying as a referee or communicating in a dispute.',
  ],
  [
    <strong key="beta">Beta and launch updates</strong>,
    'Name, email address, favourite game, participant type and the time you consented when you request beta access.',
  ],
];

const useRows = [
  [
    <strong key="service">Provide the service</strong>,
    'Create and secure accounts, connect integrations, match players, reserve stakes, administer games, settle results, operate referee assignments and process transactions.',
    'Performance of our contract with you.',
  ],
  [
    <strong key="safety">Safety and integrity</strong>,
    'Prevent cheating, fraud, payment abuse and account compromise; investigate anomalies and disputes; enforce our Terms; preserve audit trails.',
    'Our legitimate interests in providing a fair and secure service, and where applicable legal obligations.',
  ],
  [
    <strong key="compliance">Legal and regulatory compliance</strong>,
    'Age and identity checks, financial-crime controls, accounting, tax, sanctions checks, lawful requests and regulatory reporting.',
    'Legal obligation and, where appropriate, substantial public interest or legitimate interests.',
  ],
  [
    <strong key="improve">Maintain and improve PlayStake</strong>,
    'Diagnose faults, measure reliability, understand feature usage and improve usability and performance.',
    'Our legitimate interests in operating and improving the service.',
  ],
  [
    <strong key="comms">Service communications</strong>,
    'Send security, transaction, match, dispute, policy and account notices.',
    'Performance of our contract, legal obligation and legitimate interests.',
  ],
  [
    <strong key="optional">Optional marketing or analytics</strong>,
    'Send marketing or use non-essential analytics only where introduced and permitted.',
    'Consent where consent is required. You may withdraw it at any time.',
  ],
];

const cookieRows = [
  [
    <strong key="session">playstake_session</strong>,
    'Authenticates your account and helps prevent unauthorised access.',
    'Strictly necessary',
    'Up to 7 days',
  ],
  [
    <strong key="google">oauth_state</strong>,
    'Protects the Google sign-in flow against request forgery.',
    'Strictly necessary',
    'Short-lived; cleared after callback',
  ],
  [
    <strong key="kick-state">kick_oauth_state</strong>,
    'Protects the Kick connection flow against request forgery.',
    'Strictly necessary',
    'Short-lived; cleared after callback',
  ],
  [
    <strong key="kick-verifier">kick_oauth_verifier</strong>,
    'Completes the secure Kick PKCE authorisation flow.',
    'Strictly necessary',
    'Short-lived; cleared after callback',
  ],
  [
    <strong key="theme">theme (local storage)</strong>,
    'Remembers your light or dark appearance preference on your device.',
    'Preference storage',
    'Until you clear it or change your preference',
  ],
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="This policy explains how PlayStake handles personal information when you visit the website, create an account, play a match, connect Kick, make a transaction, file a dispute or act as a referee."
      lastUpdated="6 August 2026"
      toc={toc}
    >
      <LegalCallout title="A plain-language promise">
        <p>
          We use personal information to operate and protect PlayStake. We do not
          sell personal information. We do not currently use advertising or
          marketing cookies.
        </p>
      </LegalCallout>

      <LegalSection id="scope" number="01" title="Who we are and scope">
        <p>
          PlayStake Ltd is the controller of the personal information described
          in this policy. References to &ldquo;PlayStake&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; mean
          PlayStake Ltd.
        </p>
        <p>
          This policy applies to playstake.org, the PlayStake web application,
          game widget, developer interfaces, referee tools and related support.
          A third-party game, Kick, Google, Stripe or another external service
          may process information under its own privacy notice when you use it.
        </p>
        <p>
          For privacy questions or requests, contact{' '}
          <a href="mailto:support@playstake.org">support@playstake.org</a>.
        </p>
      </LegalSection>

      <LegalSection id="data" number="02" title="Information we collect">
        <LegalTable
          headers={['Category', 'Examples']}
          rows={dataRows}
        />
        <p>
          If identity or age verification is enabled, a specialist provider may
          collect identity-document, address, date-of-birth, liveness or
          source-of-funds information. PlayStake may receive the verification
          outcome and limited supporting details rather than the complete
          document. The collection screen will identify the provider and
          information required.
        </p>
      </LegalSection>

      <LegalSection
        id="sources"
        number="03"
        title="Where information comes from"
      >
        <p>We receive information:</p>
        <ul>
          <li>directly from you when you register, play or contact us;</li>
          <li>
            from Google or Kick when you authorise the relevant connection;
          </li>
          <li>
            from Stripe, banks and verification providers in connection with
            payments and checks;
          </li>
          <li>
            from games, approved developers and the PlayStake widget through
            match events and result reports;
          </li>
          <li>
            from opponents, referees and administrators during challenges,
            disputes and reviews; and
          </li>
          <li>
            automatically from your browser, device and use of the service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="uses" number="04" title="How and why we use information">
        <LegalTable
          headers={['Purpose', 'What this involves', 'UK GDPR basis']}
          rows={useRows}
        />
        <p>
          Where we rely on legitimate interests, we consider the service need,
          the impact on you and the safeguards available. You can object to
          processing based on legitimate interests; see &ldquo;Your
          rights&rdquo; below.
        </p>
        <p>
          Providing core account, match and payment information is generally
          necessary to enter and perform our contract with you. If you do not
          provide it, we may be unable to create an account or provide the
          requested feature.
        </p>
      </LegalSection>

      <LegalSection
        id="automated"
        number="05"
        title="Automated match decisions and fraud checks"
      >
        <p>
          PlayStake may use deterministic game rules and recorded events to
          validate a result and trigger settlement. The system compares reported
          outcomes with game events, scores, win conditions and result hashes.
          It may also flag unusual activity for investigation.
        </p>
        <p>
          An automated result may have a financial effect because it can release
          or return a reserved stake. Players can dispute a result within the
          displayed deadline and provide evidence. A disputed or anomalous
          result can be reviewed by a human referee or administrator, who can
          uphold, correct or void it.
        </p>
        <p>
          You may contact us to ask for information about a significant
          automated decision, express your point of view or request human
          review, subject to any legal exceptions.
        </p>
      </LegalSection>

      <LegalSection
        id="sharing"
        number="06"
        title="Who receives information"
      >
        <p>We may share relevant information with:</p>
        <ul>
          <li>
            <strong>Stripe and financial providers</strong> for payments,
            refunds, withdrawals, fraud prevention and compliance;
          </li>
          <li>
            <strong>Google and Kick</strong> when you choose to connect those
            services or when event subscriptions are needed;
          </li>
          <li>
            <strong>Railway and infrastructure providers</strong> that host the
            application, databases, queues and logs on our behalf;
          </li>
          <li>
            <strong>approved game developers</strong> where their game needs
            authenticated match events, challenge status or result webhooks;
          </li>
          <li>
            <strong>opponents and referees</strong> for match administration,
            streaming, verification, settlement and disputes;
          </li>
          <li>
            <strong>verification, security and professional advisers</strong>
            where needed for checks, risk management, legal or accounting
            support;
          </li>
          <li>
            <strong>regulators, courts and public authorities</strong> where
            disclosure is required or lawfully requested; and
          </li>
          <li>
            a buyer, investor or successor in connection with a genuine
            corporate transaction, subject to appropriate confidentiality and
            data-protection safeguards.
          </li>
        </ul>
        <p>
          Public stream and profile information may be visible to other users
          and viewers according to the feature you use. Do not include
          unnecessary personal information in display names, streams, dispute
          messages or referee biographies.
        </p>
      </LegalSection>

      <LegalSection
        id="transfers"
        number="07"
        title="International transfers"
      >
        <p>
          Some providers may process information outside the United Kingdom.
          Where UK data-protection law requires a transfer safeguard, we use an
          applicable adequacy regulation, approved contractual safeguards or
          another lawful transfer mechanism and assess supplementary safeguards
          where appropriate.
        </p>
        <p>
          Contact us if you would like information about the safeguard relevant
          to a particular provider or transfer.
        </p>
      </LegalSection>

      <LegalSection id="retention" number="08" title="How long we keep information">
        <p>
          We retain personal information only for as long as reasonably needed
          for the purposes described above, including legal, accounting,
          security, dispute and regulatory requirements. Typical periods are:
        </p>
        <ul>
          <li>
            active login sessions normally expire after <strong>7 days</strong>;
          </li>
          <li>
            account and linked-service information is kept while the account is
            active and then for a limited closure and claims period;
          </li>
          <li>
            encrypted Kick access credentials are kept until you disconnect,
            close the account or the credentials are revoked, subject to backup
            cycles;
          </li>
          <li>
            transaction, ledger, match, settlement, dispute and referee audit
            information is ordinarily retained for up to{' '}
            <strong>6 years</strong> after the relevant relationship or
            transaction, and longer where law, an investigation or a legal
            claim requires it; and
          </li>
          <li>
            failed-login, anomaly and security information is retained according
            to risk and investigation needs; and
          </li>
          <li>
            beta-signup information is kept until you unsubscribe, ask us to
            delete it or it is no longer needed for launch and beta updates.
          </li>
        </ul>
        <p>
          Some referee audit records are designed to be append-only so that a
          decision history cannot be altered. We may retain those records where
          necessary to establish, exercise or defend legal claims and protect
          match integrity. Where possible, data that no longer needs to identify
          a person will be deleted or anonymised.
        </p>
      </LegalSection>

      <LegalSection
        id="cookies"
        number="09"
        title="Cookies and local storage"
      >
        <p>
          PlayStake currently uses storage needed for authentication, OAuth
          security and your theme preference:
        </p>
        <LegalTable
          headers={['Name', 'Purpose', 'Category', 'Typical duration']}
          rows={cookieRows}
        />
        <p>
          Strictly necessary cookies are required to provide a feature you ask
          for and do not need advertising consent. If we introduce non-essential
          analytics, advertising or personalisation storage, we will provide
          appropriate information and controls before setting it where consent
          is required.
        </p>
      </LegalSection>

      <LegalSection id="security" number="10" title="How we protect information">
        <p>
          We use technical and organisational safeguards intended to protect
          personal information, including encrypted HTTPS connections, hashed
          passwords and session tokens, encrypted Kick credentials, access
          controls, rate limits, transaction idempotency, security monitoring
          and tamper-evident referee audit records.
        </p>
        <p>
          No internet service can guarantee absolute security. Keep your account
          credentials private and contact us promptly if you believe your
          account or personal information has been compromised.
        </p>
      </LegalSection>

      <LegalSection id="rights" number="11" title="Your data-protection rights">
        <p>
          Depending on the circumstances, UK data-protection law may give you
          rights to:
        </p>
        <ul>
          <li>obtain a copy of your personal information;</li>
          <li>correct inaccurate or incomplete information;</li>
          <li>request deletion or restriction;</li>
          <li>object to processing based on legitimate interests;</li>
          <li>receive certain information in a portable format;</li>
          <li>withdraw consent where processing relies on consent; and</li>
          <li>
            request safeguards around certain solely automated decisions.
          </li>
        </ul>
        <p>
          These rights are not absolute. For example, we may need to keep
          transaction, fraud-prevention, dispute or audit records to comply with
          law or establish and defend legal claims.
        </p>
        <p>
          To exercise a right, email{' '}
          <a href="mailto:support@playstake.org">support@playstake.org</a>. We
          may need to verify your identity before acting on the request.
        </p>
      </LegalSection>

      <LegalSection id="complaints" number="12" title="Questions and complaints">
        <p>
          Please contact us first so we can try to resolve your concern. You also
          have the right to complain to the UK Information Commissioner&rsquo;s
          Office:
        </p>
        <p>
          <a
            href="https://ico.org.uk/make-a-complaint/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ico.org.uk/make-a-complaint
          </a>
        </p>
        <p>
          If you live outside the UK, you may also be able to contact the
          data-protection authority where you live.
        </p>
      </LegalSection>

      <LegalSection id="children" number="13" title="Children">
        <p>
          PlayStake is intended only for people aged 18 or over. We do not
          knowingly offer accounts to children. If you believe a child has
          provided personal information, contact us so we can investigate and
          take appropriate action.
        </p>
      </LegalSection>

      <LegalSection
        id="changes"
        number="14"
        title="Changes to this policy and contact"
      >
        <p>
          We may update this policy when the service, providers or law changes.
          We will update the date above and provide additional notice where a
          change is material.
        </p>
        <p>
          Privacy questions and requests can be sent to PlayStake Ltd at{' '}
          <a href="mailto:support@playstake.org">support@playstake.org</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
