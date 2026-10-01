import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalCallout,
  LegalPage,
  LegalSection,
  LegalTable,
} from '@/components/legal/LegalPage';
import { createPublicMetadata } from '@/lib/seo';
import { MATCH_RULES_VERSION, REFEREE_CODE_VERSION } from '@/lib/rules';

export const metadata: Metadata = createPublicMetadata({
  title: 'Match Rules',
  description:
    'The rules every player agrees to for live stream matches on PlayStake, and the Code of Conduct every human referee follows.',
  path: '/match-rules',
});

const toc = [
  { id: 'players', label: 'Rules for players' },
  { id: 'before', label: 'Before the match' },
  { id: 'during', label: 'During the match' },
  { id: 'interruptions', label: 'Disconnects and interruptions' },
  { id: 'results', label: 'Results and disputes' },
  { id: 'referees', label: 'Referee Code of Conduct' },
  { id: 'independence', label: 'Independence' },
  { id: 'officiating', label: 'Officiating a match' },
  { id: 'decisions', label: 'Making a decision' },
  { id: 'breaches', label: 'Breaking the rules' },
];

export default function MatchRulesPage() {
  return (
    <LegalPage
      eyebrow="Rules"
      title="Match Rules and Referee Code of Conduct"
      summary="Live stream matches are played between two people and decided by an independent human referee. These rules keep them fair. Players agree to them before their first challenge, and referees agree to the Code of Conduct before they officiate."
      lastUpdated="1 October 2026"
      toc={toc}
    >
      <LegalSection id="players" number="01" title="Rules for players">
        <p>
          These rules apply to every live stream match on PlayStake: a challenge between two
          players on a console or PC game, streamed on Kick and decided by a referee. They sit
          alongside our <Link href="/terms">Terms</Link> and <Link href="/fair-play">Fair Play</Link>{' '}
          policy. Matches in PlayStake&apos;s own games, such as Darts 301, are decided by our servers
          and follow the rules shown on each game.
        </p>
        <ul>
          <li>You must be 18 or over, with a verified identity, playing from your own account.</li>
          <li>You can&apos;t play while on a cool-off break or self-excluded.</li>
          <li>The same two players can play each other at most 5 times in any hour.</li>
        </ul>
        <p className="text-xs">Match Rules version {MATCH_RULES_VERSION}.</p>
      </LegalSection>

      <LegalSection id="before" number="02" title="Before the match">
        <ul>
          <li>
            <strong>Go live on your own Kick channel</strong>, connected to your PlayStake account,
            playing the game you both declared. A referee can only start the match while both of
            you are live on that game.
          </li>
          <li>
            <strong>Show the game clearly.</strong> Your stream must show the full game screen,
            including the score, for the whole match. Don&apos;t cover, blur or crop it, and keep any
            stream delay to the minimum Kick allows.
          </li>
          <li>
            <strong>Agree the settings on stream</strong> before the referee starts the match: mode,
            length, and any team or ruleset limits. Say them on your stream so they&apos;re on the
            record. If you don&apos;t agree anything, the game&apos;s standard online one-against-one
            settings apply.
          </li>
          <li>
            <strong>Be ready on time.</strong> If no referee takes the match within 10 minutes of it
            being agreed, it is cancelled and both stakes are returned in full.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="during" number="03" title="During the match">
        <ul>
          <li>
            <strong>Play it yourself.</strong> Nobody else may play, control or advise you during
            the match.
          </li>
          <li>
            <strong>No cheating.</strong> No cheats, hacks, mods, macros, scripts, bots or any
            software that plays or aims for you, and no deliberate use of bugs or glitches.
          </li>
          <li>
            <strong>No fixing.</strong> Never agree a result, lose on purpose, or arrange anything
            with your opponent or anyone else about the outcome.
          </li>
          <li>
            <strong>Don&apos;t watch your opponent&apos;s stream</strong> during the match, or have anyone
            pass on what it shows.
          </li>
          <li>
            <strong>Stay live</strong> on the declared game until the referee records the result.
          </li>
          <li>
            <strong>Be respectful.</strong> No abuse, threats, harassment or discrimination towards
            your opponent, the referee or anyone in chat.
          </li>
          <li>
            <strong>Leave the referee to decide.</strong> The referee posts in match chat, which you
            can read; anything you need to tell them, say on your stream. Never try to pressure or
            reward them, and don&apos;t contact them privately about the result.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="interruptions" number="04" title="Disconnects and interruptions">
        <ul>
          <li>
            If your stream or game drops, reconnect as quickly as you can and say what happened on
            your stream. The referee will post in match chat what happens next.
          </li>
          <li>
            The referee decides what is fair from what both streams show: carry on, replay the
            affected part, or award the match. If a player hasn&apos;t returned within 10 minutes, the
            referee may award the match to the other player.
          </li>
          <li>
            A match must be finished within 2 hours of starting. If it isn&apos;t, it is cancelled and
            both stakes are returned in full.
          </li>
          <li>
            If something goes wrong on PlayStake&apos;s side, we review the match and either return both
            stakes or correct the result.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="results" number="05" title="Results and disputes">
        <ul>
          <li>
            The referee records the result (a win for either player, or a draw) with written notes
            on what decided it.
          </li>
          <li>
            Either player can dispute the decision from the bet page within{' '}
            <strong>15 minutes</strong>. Nothing is paid out until that time has passed. Say what you
            think was wrong and point to the moment on stream.
          </li>
          <li>
            Our team reviews both streams, match chat and the referee&apos;s notes, and either upholds
            or corrects the result. Every step is kept on a record that can&apos;t be edited.
          </li>
          <li>
            If you&apos;re unhappy with how a dispute was handled, use our{' '}
            <Link href="/complaints">complaints procedure</Link>, and after our final response you can
            go to IBAS, the independent adjudicator.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="referees" number="06" title="Referee Code of Conduct">
        <p>
          Referees are approved by PlayStake to officiate live stream matches. Every referee agrees
          to this Code before they can officiate, and again whenever it changes. Referees earn 10%
          of the platform fee on each match they officiate, paid when the match settles.
        </p>
        <ul>
          <li>You must be 18 or over, with a verified identity and a connected Kick account.</li>
          <li>Only officiate games PlayStake has approved you for.</li>
          <li>
            Only make yourself available when you can give a match your full attention. Claim a match
            only if you can start it within 5 minutes; otherwise it passes to another referee.
          </li>
          <li>You can officiate one match at a time, and must stay for the whole match.</li>
        </ul>
        <p className="text-xs">Code of Conduct version {REFEREE_CODE_VERSION}.</p>
      </LegalSection>

      <LegalSection id="independence" number="07" title="Independence">
        <ul>
          <li>Never officiate a match you are playing in.</li>
          <li>
            Don&apos;t officiate if you know either player personally, share a household or team with
            them, or have any financial link to them. If you realise this after claiming, release the
            match and tell us.
          </li>
          <li>
            Never bet on a match you officiate, or let anyone bet on your behalf, and never share
            inside information about a match.
          </li>
          <li>Don&apos;t accept gifts, tips or payments from players, other than your PlayStake fee.</li>
        </ul>
      </LegalSection>

      <LegalSection id="officiating" number="08" title="Officiating a match">
        <ul>
          <li>Go live on your own Kick channel before you start, so the call is made in the open.</li>
          <li>
            Before starting, check both players are live on the declared game and have agreed the
            settings on stream.
          </li>
          <li>Watch both streams for the whole match.</li>
          <li>
            Stay neutral: don&apos;t coach or advise either player, and communicate with players only in
            match chat. Be courteous, even when they aren&apos;t.
          </li>
          <li>
            Report anything that looks like cheating, fixing or a player who isn&apos;t who they should
            be, in your decision notes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="decisions" number="09" title="Making a decision">
        <ul>
          <li>Decide only on what you saw on the streams, not on what anyone tells you.</li>
          <li>
            Write clear notes: the final score, what decided the match, and the time on stream of any
            key moment.
          </li>
          <li>If you can&apos;t tell who won from the streams, record a draw and explain why.</li>
          <li>
            Don&apos;t change a decision because of pressure from a player. Help our team if a decision
            is disputed.
          </li>
          <li>
            Keep players&apos; personal details, match chat and disputes private. Don&apos;t discuss them in
            public.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="breaches" number="10" title="Breaking the rules">
        <p>If a player or referee breaks these rules, depending on how serious it is, we may:</p>
        <LegalTable
          headers={['Who', 'What we may do']}
          rows={[
            ['Player', 'Award the match to the opponent; cancel it; withhold winnings from affected matches; suspend or close the account.'],
            ['Referee', 'Overturn the decision; withhold the referee fee; suspend or remove referee status; suspend or close the account.'],
            ['Anyone involved in cheating or fixing', 'All of the above, and report it to the Gambling Commission and, where appropriate, the police. See Fair Play.'],
          ]}
        />
        <LegalCallout title="Your stakes are protected">
          Stakes sit in a separate escrow account for each match until it settles or is cancelled.
          If a match is cancelled, both stakes are returned in full. See{' '}
          <Link href="/fair-play">Fair Play</Link> for how we treat money won unfairly.
        </LegalCallout>
      </LegalSection>
    </LegalPage>
  );
}
