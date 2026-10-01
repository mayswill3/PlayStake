// =============================================================================
// PlayStake — Frequently asked questions
// =============================================================================
// One source for the /faq page and the homepage FAQ section. Answers make
// promises to customers, so each one must describe what the platform does
// today. When a control changes (fees, disputes, safer gambling, GAMSTOP),
// update the answer here in the same change.
// =============================================================================

export interface FaqLink {
  href: string;
  label: string;
}

export interface FaqItem {
  /** Stable anchor, e.g. /faq#fees. Don't change once published. */
  id: string;
  q: string;
  a: string;
  links?: FaqLink[];
  /** Shown in the homepage FAQ section. */
  featured?: boolean;
}

export interface FaqCategory {
  id: string;
  title: string;
  items: FaqItem[];
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        id: 'what-is-playstake',
        q: 'What is PlayStake?',
        a: 'PlayStake lets you put money on your own skill. You and another player each stake the same amount on a match, and the winner takes the pot, less a small fee shown before you commit. We match players, hold the stakes safely until the result is in, and pay the winner. We never bet against you.',
        featured: true,
      },
      {
        id: 'who-can-play',
        q: 'Who can play?',
        a: "You must be 18 or over and verify your identity before you can deposit or play for money. You'll need a passport, driving licence or national ID card. Each person can have one account.",
        links: [{ href: '/verification', label: 'Verify your ID' }],
      },
      {
        id: 'licence',
        q: 'Is PlayStake licensed?',
        a: "PlayStake doesn't hold a gambling licence yet. We're applying to the Gambling Commission, and real-money play will only switch on once we're licensed. Until then PlayStake is in closed beta.",
      },
      {
        id: 'launch',
        q: 'When will real-money play launch?',
        a: "When our Gambling Commission licence is granted. Beta users will hear first. Until then you can try matchmaking and play with test payments only; no real money is taken.",
      },
    ],
  },
  {
    id: 'matches',
    title: 'Matches and results',
    items: [
      {
        id: 'what-can-i-play',
        q: 'What can I play?',
        a: "Live stream matches in popular console and PC games such as EA SPORTS FC 26, Fortnite, Call of Duty and Rocket League, played on Kick. And PlayStake's own games, Tic-Tac-Toe and Darts 301, which you play right on the site.",
        links: [{ href: '/play', label: 'Browse games' }],
      },
      {
        id: 'stream-challenges',
        q: 'How do stream challenges work?',
        a: "A streamer connects their Kick channel, goes live and picks the game they're playing. A viewer sends them a challenge with a stake. If the streamer accepts, both stakes are locked in and the match starts once an independent referee joins. Both players must be live on Kick so the referee can watch both feeds. Every stream match is played under our Match Rules, which you accept before your first challenge.",
        links: [{ href: '/match-rules', label: 'Match Rules' }],
        featured: true,
      },
      {
        id: 'results',
        q: 'How are results decided?',
        a: "Stream matches are decided by an independent, approved referee who watches both live streams and records the result with evidence. In PlayStake's own games, our servers apply the rules, make any random draw (like the scatter on a dart) and decide the result. Neither player can choose or change a result, and every move and decision is kept on a record that can't be edited.",
        links: [{ href: '/fair-play', label: 'How we keep games fair' }],
        featured: true,
      },
      {
        id: 'opponent-leaves',
        q: 'What if my opponent leaves or the match is interrupted?',
        a: "Every move is saved, so if your connection drops you can open the match again and carry on. If a match is never started within 10 minutes, it's cancelled and both stakes are returned in full. If a match starts and then nobody moves for 10 minutes, the player whose turn it was forfeits. If something goes wrong on our side, we review the match and either return both stakes or correct the result.",
        links: [{ href: '/fair-play#interrupted', label: 'Interrupted matches' }],
      },
      {
        id: 'disputes',
        q: 'What happens in a dispute?',
        a: "For stream matches, either player can dispute the referee's decision within 15 minutes, and nothing is paid out until that time has passed. For other matches you can dispute a result within 24 hours of it being reported. We review the game record, stream footage and referee evidence, and correct the result if it was wrong. If you're unhappy with how we handle it, you can make a complaint.",
        links: [
          { href: '/match-rules#results', label: 'Disputes under the Match Rules' },
          { href: '/complaints', label: 'Complaints procedure' },
        ],
      },
      {
        id: 'referees',
        q: 'What is a referee, and can I become one?',
        a: "Referees are approved people who officiate stream matches. They must verify their identity, can't officiate a match they're playing in, and every decision they make is recorded. Referees earn 10% of the platform fee on each match they officiate. You can apply from the Referee Hub.",
        links: [
          { href: '/referees/human', label: 'Become a referee' },
          { href: '/match-rules#referees', label: 'Referee Code of Conduct' },
        ],
      },
    ],
  },
  {
    id: 'money',
    title: 'Money',
    items: [
      {
        id: 'staking',
        q: 'How does staking work?',
        a: "You both agree the stake first. Nothing leaves your balance until you accept. Then both stakes move into a separate escrow account for that match, where neither player can touch them. When the match settles, the winner receives the pot less the fee. A draw splits it equally.",
      },
      {
        id: 'fees',
        q: 'What does PlayStake charge?',
        a: "We take a percentage of the pot when a match settles. The fee depends on the game, and some games have none. The fee, what a win pays and what a draw returns are always shown on the stake screen and on the invite before you commit. If a match is cancelled, both stakes are returned in full with no fee.",
        featured: true,
      },
      {
        id: 'deposits-withdrawals',
        q: 'How do deposits and withdrawals work?',
        a: "You deposit by card. Payments are processed by Stripe, so your card details never reach PlayStake. To withdraw, you link your bank account through Stripe once, then withdraw to it. Your identity must be verified first. Occasionally we need to review a withdrawal for security or legal reasons before it's paid.",
        links: [{ href: '/wallet', label: 'Go to your wallet' }],
      },
      {
        id: 'stakes-safe',
        q: 'Are my stakes safe during a match?',
        a: 'Yes. From the moment both players accept, stakes sit in an escrow account for that match only. They can only go to the winner, be split on a draw, or be returned if the match is cancelled.',
      },
    ],
  },
  {
    id: 'safer-gambling',
    title: 'Safer gambling',
    items: [
      {
        id: 'tools',
        q: 'What tools can I use to stay in control?',
        a: 'From Safer Gambling in your account you can set daily, weekly and monthly deposit limits (lowering one works straight away; raising one takes 24 hours), take a break from 24 hours to 6 weeks, self-exclude for 6 months to 5 years, and turn on reminders every 15 minutes to 2 hours. A clock and session timer stay on screen while you play.',
        links: [{ href: '/responsible-play', label: 'Safer Gambling settings' }],
        featured: true,
      },
      {
        id: 'gamstop',
        q: 'Do you work with GAMSTOP?',
        a: "GAMSTOP is the free national scheme that lets you block yourself from all UK-licensed gambling sites at once. Before real-money play launches, we'll check every customer against it, and anyone registered won't be able to gamble with us. You can sign up at gamstop.co.uk.",
        links: [{ href: 'https://www.gamstop.co.uk', label: 'gamstop.co.uk' }],
      },
      {
        id: 'help',
        q: 'Where can I get help?',
        a: "If gambling is causing you problems, or you're worried about someone else, you can talk to GamCare for free, 24 hours a day, on 0808 8020 133. BeGambleAware also has advice and support. You can also contact us, and we'll help you set limits or take a break.",
        links: [
          { href: 'https://www.gamcare.org.uk', label: 'GamCare' },
          { href: 'https://www.begambleaware.org', label: 'BeGambleAware' },
        ],
      },
    ],
  },
  {
    id: 'account',
    title: 'Account and help',
    items: [
      {
        id: 'why-verify',
        q: 'Why do I need to verify my identity?',
        a: "The law requires us to check that every customer is 18 or over and is who they say they are before they gamble. It also protects your account and helps stop fraud. Your documents are encrypted, and only our verification team can see them.",
      },
      {
        id: 'complaints',
        q: 'How do I make a complaint?',
        a: "Use the form on our complaints page or email support@playstake.org. You'll get a reference straight away and a final answer within 8 weeks. If you're not happy with our answer, you can take it to IBAS, an independent adjudicator, for free.",
        links: [{ href: '/complaints', label: 'Complaints procedure' }],
      },
      {
        id: 'contact',
        q: 'How do I contact PlayStake?',
        a: 'Email support@playstake.org and our team will get back to you.',
        links: [{ href: 'mailto:support@playstake.org', label: 'support@playstake.org' }],
      },
    ],
  },
];

export const FEATURED_FAQS: FaqItem[] = FAQ_CATEGORIES.flatMap((category) =>
  category.items.filter((item) => item.featured),
);
