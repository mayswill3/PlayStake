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
      lastUpdated="25 October 2026"
      toc={toc}
    >
      <LegalSection id="results" number="01" title="How results are decided">
        <p>
          Every match is played between two people, both streaming their own screen on Kick, and
          decided by an independent, approved human referee who watches both streams. Neither
          player, and no one at PlayStake, can enter or change a result.
        </p>
        <ul>
          <li>
            <strong>Independent referees.</strong> A referee can never officiate a match they are
            playing in, and is never offered a match with anyone they follow, who follows them, or
            with whom there is a block.
          </li>
          <li>
            <strong>Decided from the streams.</strong> The referee records the result shown on both
            streams, with written notes on what decided it. If they can&apos;t tell, they record a
            draw.
          </li>
          <li>
            <strong>Time to dispute.</strong> Either player can dispute the result within 15
            minutes. Nothing is paid out until that time has passed.
          </li>
          <li>
            <strong>Everything is recorded.</strong> Every referee action is written to a permanent
            match record that can&apos;t be edited. If you question a result, we review it with both
            streams and match chat.
          </li>
        </ul>
        <p>
          The full rules are in the <Link href="/match-rules">Match Rules</Link> and{' '}
          <Link href="/terms">our terms</Link>.
        </p>
      </LegalSection>

      <LegalSection id="rules" number="02" title="Game rules">
        <p>
          Players agree their settings on stream before the referee starts the match. If they
          don&apos;t, the standard settings on each game&apos;s page apply:
        </p>
        <LegalTable
          headers={['Game', 'How you win', 'Draws']}
          rows={[
            ['EA SPORTS FC 27', 'Win the online friendly (6-minute halves by default) on the final score shown on both streams.', 'A draw at full time stays a draw, unless extra time and penalties were agreed on stream first.'],
            ['Tekken 8', 'Be first to win 3 games (each best of 3 rounds) in a private player match.', "A set always has a winner; it's only a draw if the referee can't tell what happened."],
          ]}
        />
        <p>
          See <Link href="/games/ea-sports-fc-27">how FC 27 matches work</Link> and{' '}
          <Link href="/games/tekken-8">how Tekken 8 sets work</Link>.
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
          If your stream or game drops, reconnect as quickly as you can and say what happened on
          your stream. The referee decides what is fair from what both streams show: carry on,
          replay the affected part, or award the match.
        </p>
        <LegalTable
          headers={['What happened', 'What we do']}
          rows={[
            ['No referee took the match within 10 minutes of it being agreed', 'The match is cancelled. Both stakes are returned in full.'],
            ['A player dropped out and hasn’t returned within 10 minutes', 'The referee may award the match to the other player.'],
            ['The match wasn’t finished within 2 hours of starting', 'The match is cancelled. Both stakes are returned in full.'],
            ['Something went wrong on our side (an outage or a fault)', 'We review the match. If it cannot fairly be completed, we cancel it and return both stakes in full. If a fault led to a wrong payment, we correct it.'],
          ]}
        />
        <p>
          If you think a decision was caused by a problem on our side, contact us through the{' '}
          <Link href="/complaints">complaints procedure</Link> and we will review the match.
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
          If you think an opponent or a referee broke the rules, or you have found a problem, email{' '}
          <a href="mailto:support@playstake.org">support@playstake.org</a> with the match link, or
          use the <Link href="/complaints">complaints procedure</Link>. Reports are confidential.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
