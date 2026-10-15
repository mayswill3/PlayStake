import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalCallout,
  LegalPage,
  LegalSection,
  LegalTable,
} from '@/components/legal/LegalPage';
import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'Fair Play',
  description:
    'How PlayStake decides results, what we charge, what happens when a match is interrupted, and how we deal with cheating, collusion and bots.',
  path: '/fair-play',
});

const toc = [
  { id: 'results', label: 'How results are decided' },
  { id: 'rules', label: 'Game rules' },
  { id: 'fees', label: 'Fees and payouts' },
  { id: 'interrupted', label: 'Interrupted and abandoned matches' },
  { id: 'cheating', label: 'Cheating, collusion and bots' },
  { id: 'funds', label: 'What happens to money won unfairly' },
  { id: 'report', label: 'Report something' },
];

export default function FairPlayPage() {
  return (
    <LegalPage
      eyebrow="Help"
      title="Fair Play"
      summary="You play against other people, not against us. This page explains how every result is decided, what we charge, what happens if a match is cut short, and what we do to stop anyone cheating."
      lastUpdated="30 September 2026"
      toc={toc}
    >
      <LegalSection id="results" number="01" title="How results are decided">
        <p>
          Every game on <Link href="/play">/play</Link> runs on PlayStake&apos;s servers, not in
          your browser. Your device sends what you did (a move, or where you aimed a dart). Our
          server applies the rules, makes any random draw, and decides the
          result. Neither player, and no one at PlayStake, can choose or change a result.
        </p>
        <ul>
          <li>
            <strong>Random draws</strong> (the scatter on a dart) come from a cryptographically
            secure random number generator. Nothing you or your
            opponent does can predict or influence them.
          </li>
          <li>
            <strong>Everything is recorded.</strong> Each move, each random draw and each result
            is written to a permanent match record that can&apos;t be edited. If you question a
            result, we check it against that record.
          </li>
        </ul>
        <p>
          Live stream matches are decided differently: an independent human referee watches both
          streams, and the result can be disputed before any money moves. See{' '}
          <Link href="/terms">our terms</Link> and the <Link href="/match-rules">Match Rules</Link>.
        </p>
      </LegalSection>

      <LegalSection id="rules" number="02" title="Game rules">
        <p>The full rules are shown on each game&apos;s page before you join. In short:</p>
        <LegalTable
          headers={['Game', 'How you win', 'Draws']}
          rows={[
            ['Tic-Tac-Toe', 'Three in a row. X (the player who set the stake) moves first.', 'A full board with no line is a draw.'],
            ['Darts 301', 'Start on 301, three rounds of three darts each. Reach exactly zero to win at once; otherwise the lower score after three rounds wins. Going below zero is a bust and the turn’s score is cancelled.', 'Equal scores after three rounds are a draw.'],
          ]}
        />
        <p>
          In darts you choose where to aim and how long to steady the throw. Steadier throws, aimed
          nearer the centre, scatter less, but every dart lands with some random scatter, so skill
          improves your chances without guaranteeing a score.
        </p>
      </LegalSection>

      <LegalSection id="fees" number="03" title="Fees and payouts">
        <p>
          Both players stake the same amount. Where a game carries a fee, PlayStake takes a
          percentage of the pot when the match settles. The fee, what a win pays and what a draw
          returns are shown on the stake screen and on every invite <em>before</em> you commit.
        </p>
        <ul>
          <li>A win pays the whole pot less the fee.</li>
          <li>A draw splits the pot less the fee equally between the two players.</li>
          <li>A match that is voided returns both stakes in full, with no fee.</li>
        </ul>
      </LegalSection>

      <LegalSection id="interrupted" number="04" title="Interrupted and abandoned matches">
        <p>
          The state of every match is saved on our servers after each move. If your connection
          drops or you close the tab, open the match again from the same link, or from your bets,
          and carry on from where you left off.
        </p>
        <LegalTable
          headers={['What happened', 'What we do']}
          rows={[
            ['Nobody started the match within 10 minutes of it being agreed', 'The match is void. Both stakes are returned in full.'],
            ['The match started, then no move was made for 10 minutes', 'The player whose move it was is treated as having left and forfeits. The other player wins. This stops anyone walking away from a losing position to get their stake back.'],
            ['The match finished but was not settled (for example, a tab closed on the last move)', 'We settle it on the recorded result.'],
            ['Something went wrong on our side (an outage or a fault)', 'We review the match record. If it cannot fairly be completed, we void it and return both stakes in full. If a fault led to a wrong payment, we correct it.'],
          ]}
        />
        <p>
          If you think a forfeit was caused by a problem on our side rather than by you leaving,
          contact us through the <Link href="/complaints">complaints procedure</Link> and we will
          look at the match record.
        </p>
      </LegalSection>

      <LegalSection id="cheating" number="05" title="Cheating, collusion and bots">
        <p>It is against our terms to:</p>
        <ul>
          <li>agree results, or lose on purpose, with another player;</li>
          <li>play against yourself, or with anyone sharing your account, device or payment details;</li>
          <li>use bots, scripts or any software that plays or aims for you;</li>
          <li>exploit a bug or fault rather than report it;</li>
          <li>interfere with another player&apos;s connection, or with our service.</li>
        </ul>
        <p>
          We look for patterns that suggest cheating: the same players repeatedly matched against
          each other, one-sided results between the same pair, win rates that don&apos;t fit the
          game, unusually fast matches, sudden changes in volume, and accounts linked by identity or
          payment details. Our staff review anything flagged.
        </p>
      </LegalSection>

      <LegalSection id="funds" number="06" title="What happens to money won unfairly">
        <p>If we find that a player cheated, colluded or used a bot, we will:</p>
        <ul>
          <li>suspend the accounts involved while we investigate;</li>
          <li>void the affected matches and withhold any winnings from them;</li>
          <li>
            return stakes to players who lost to the cheating, where we can identify them, and
            tell them what happened;
          </li>
          <li>close the accounts involved, and report the matter to the Gambling Commission and,
            where appropriate, the police.</li>
        </ul>
        <LegalCallout title="Your stakes are protected">
          Stakes are held in a separate escrow account for each match from the moment both players
          agree, until the match settles or is voided. They can&apos;t be used for anything else.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="report" number="07" title="Report something">
        <p>
          If you think an opponent cheated, or you have found a problem with a game, email{' '}
          <a href="mailto:support@playstake.org">support@playstake.org</a> with the match link, or
          use the <Link href="/complaints">complaints procedure</Link>. Reports are confidential.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
