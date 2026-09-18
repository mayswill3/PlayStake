// =============================================================================
// PlayStake — Email templates
// =============================================================================
// One entry per email. Each takes a JSON-serialisable payload (stored in the
// outbox row) and returns the subject plus the layout content, so the worker
// can render any email from just a template name and its payload.
//
// `essential: true` means the email always sends — security, money and
// responsible-play messages. Everything else respects the user's
// emailNotifications preference.
// =============================================================================

import { appUrl, renderHtml, renderText, type EmailLayoutInput } from './layout';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface TemplateDefinition<P> {
  essential: boolean;
  subject: (payload: P) => string;
  content: (payload: P) => EmailLayoutInput;
}

/** Payloads are stored as JSON, so every field must survive a round trip. */
type Payloads = {
  // --- Account & security -------------------------------------------------
  'auth.verify-email': { name: string; url: string };
  'auth.password-reset': { name: string; url: string };
  'auth.password-changed': { name: string; changedAt: string };
  'auth.two-factor-changed': { name: string; enabled: boolean };
  // --- Identity verification ---------------------------------------------
  'kyc.submitted': { name: string };
  'kyc.approved': { name: string };
  'kyc.rejected': { name: string; reviewNotes?: string | null };
  // --- Money --------------------------------------------------------------
  'wallet.deposit-succeeded': { name: string; amount: string; balance: string };
  'wallet.deposit-failed': { name: string; amount: string; reason: string };
  'wallet.withdrawal-requested': { name: string; amount: string; balance: string };
  'wallet.withdrawal-paid': { name: string; amount: string };
  'wallet.withdrawal-failed': { name: string; amount: string; reason: string };
  // --- Matches ------------------------------------------------------------
  'bet.settled': {
    name: string;
    gameName: string;
    opponent: string;
    outcome: 'won' | 'lost' | 'draw';
    stake: string;
    netResult: string;
    balance: string;
    betId: string;
  };
  'bet.voided': { name: string; gameName: string; stake: string; reason: string; betId: string };
  'bet.dispute-filed': { name: string; gameName: string; betId: string; byOpponent: boolean };
  'bet.dispute-resolved': { name: string; gameName: string; outcome: string; betId: string };
  'bet.referee-decision': {
    name: string;
    gameName: string;
    decision: string;
    disputeDeadline: string;
    betId: string;
  };
  // --- Referees -----------------------------------------------------------
  'referee.application-received': { name: string };
  'referee.application-decided': {
    name: string;
    status: 'approved' | 'rejected' | 'suspended';
    notes?: string | null;
  };
  'referee.match-available': { name: string; gameName: string; players: string; reward: string };
  'referee.fee-paid': { name: string; amount: string; gameName: string; balance: string };
  // --- Responsible play ---------------------------------------------------
  'responsible.deposit-limit-changed': {
    name: string;
    period: string;
    amount: string;
    effectiveAt?: string | null;
  };
  'responsible.break-started': { name: string; kind: string; endsAt: string | null };
  'responsible.break-ended': { name: string; kind: string };
  // --- Other --------------------------------------------------------------
  'kick.connection-changed': { name: string; channel: string; connected: boolean };
  'beta.signup-received': { name: string };
  // --- Admin (to the ops inbox, not players) ------------------------------
  'admin.alert': { title: string; detail: string; url?: string | null };
};

export type EmailTemplateName = keyof Payloads;
export type EmailPayload<N extends EmailTemplateName> = Payloads[N];

const bets = (betId: string) => appUrl(`/bets/${betId}`);

const TEMPLATES: { [N in EmailTemplateName]: TemplateDefinition<Payloads[N]> } = {
  // ---------------------------------------------------------------- account
  'auth.verify-email': {
    essential: true,
    subject: () => 'Verify your PlayStake email',
    content: (p) => ({
      eyebrow: 'Welcome',
      heading: 'Verify your email address',
      name: p.name,
      paragraphs: [
        'Confirm this address to finish setting up your PlayStake account.',
        'This link expires in 24 hours. If you did not create this account, you can ignore this email.',
      ],
      cta: { label: 'Verify email', url: p.url },
    }),
  },
  'auth.password-reset': {
    essential: true,
    subject: () => 'Reset your PlayStake password',
    content: (p) => ({
      eyebrow: 'Security',
      heading: 'Reset your password',
      name: p.name,
      paragraphs: [
        'Use the secure link below to choose a new password.',
        'It expires in one hour and can only be used once. If you did not request it, you can ignore this email — your password will not change.',
      ],
      cta: { label: 'Reset password', url: p.url },
    }),
  },
  'auth.password-changed': {
    essential: true,
    subject: () => 'Your PlayStake password was changed',
    content: (p) => ({
      eyebrow: 'Security',
      heading: 'Your password was changed',
      name: p.name,
      paragraphs: [
        `The password on your PlayStake account was changed on ${p.changedAt}.`,
        'If this was you, no action is needed.',
      ],
      callout: 'If this was not you, reset your password immediately and contact support.',
      cta: { label: 'Reset password', url: appUrl('/forgot-password') },
    }),
  },
  'auth.two-factor-changed': {
    essential: true,
    subject: (p) =>
      p.enabled ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled',
    content: (p) => ({
      eyebrow: 'Security',
      heading: p.enabled
        ? 'Two-factor authentication is on'
        : 'Two-factor authentication is off',
      name: p.name,
      paragraphs: p.enabled
        ? [
            'Your account now asks for a code from your authenticator app at sign-in.',
            'Keep your backup codes somewhere safe — they are the way back in if you lose your device.',
          ]
        : ['Two-factor authentication has been turned off for your account.'],
      callout: p.enabled
        ? undefined
        : 'If this was not you, turn it back on and change your password straight away.',
      cta: { label: 'Open security settings', url: appUrl('/settings') },
    }),
  },
  // -------------------------------------------------------------------- kyc
  'kyc.submitted': {
    essential: true,
    subject: () => 'We have your verification documents',
    content: (p) => ({
      eyebrow: 'Identity check',
      heading: 'Documents received',
      name: p.name,
      paragraphs: [
        'A reviewer will check your documents, usually within one business day.',
        'We will email you as soon as there is a decision. Deposits and withdrawals stay locked until then.',
      ],
      cta: { label: 'View status', url: appUrl('/verification') },
    }),
  },
  'kyc.approved': {
    essential: true,
    subject: () => 'Your PlayStake identity check is approved',
    content: (p) => ({
      eyebrow: 'Identity check',
      heading: 'You are verified',
      name: p.name,
      paragraphs: [
        'Your identity has been verified. Deposits and withdrawals are now unlocked on your account.',
      ],
      cta: { label: 'Go to your wallet', url: appUrl('/wallet') },
    }),
  },
  'kyc.rejected': {
    essential: true,
    subject: () => 'Your PlayStake identity check needs another look',
    content: (p) => ({
      eyebrow: 'Identity check',
      heading: 'We could not verify your documents',
      name: p.name,
      paragraphs: [
        'We could not verify your identity from the documents provided.',
        ...(p.reviewNotes ? [`Reviewer notes: ${p.reviewNotes}`] : []),
        'You can submit new documents at any time — clear photos of the whole document work best.',
      ],
      cta: { label: 'Submit new documents', url: appUrl('/verification') },
    }),
  },
  // ------------------------------------------------------------------ money
  'wallet.deposit-succeeded': {
    essential: true,
    subject: (p) => `Deposit received — ${p.amount}`,
    content: (p) => ({
      eyebrow: 'Deposit',
      heading: 'Your deposit landed',
      name: p.name,
      paragraphs: ['Your funds are available to stake right away.'],
      facts: [
        { label: 'Amount', value: p.amount, accent: true },
        { label: 'New balance', value: p.balance },
      ],
      cta: { label: 'Open your wallet', url: appUrl('/wallet') },
    }),
  },
  'wallet.deposit-failed': {
    essential: true,
    subject: () => 'Your PlayStake deposit did not go through',
    content: (p) => ({
      eyebrow: 'Deposit',
      heading: 'That deposit failed',
      name: p.name,
      paragraphs: [
        `We could not take the ${p.amount} payment.`,
        `Reason given by the payment provider: ${p.reason}`,
        'No money has left your account. You can try again with the same or another payment method.',
      ],
      cta: { label: 'Try again', url: appUrl('/wallet/deposit') },
    }),
  },
  'wallet.withdrawal-requested': {
    essential: true,
    subject: (p) => `Withdrawal requested — ${p.amount}`,
    content: (p) => ({
      eyebrow: 'Withdrawal',
      heading: 'Your withdrawal is on its way',
      name: p.name,
      paragraphs: [
        'We have sent this to your connected payout account. Banks usually take one to three business days.',
      ],
      facts: [
        { label: 'Amount', value: p.amount, accent: true },
        { label: 'Remaining balance', value: p.balance },
      ],
      callout: 'Did not request this? Contact support immediately.',
      cta: { label: 'View transactions', url: appUrl('/wallet/transactions') },
    }),
  },
  'wallet.withdrawal-paid': {
    essential: true,
    subject: (p) => `Withdrawal paid — ${p.amount}`,
    content: (p) => ({
      eyebrow: 'Withdrawal',
      heading: 'Your payout has arrived',
      name: p.name,
      paragraphs: [`${p.amount} has been paid out to your connected account.`],
      cta: { label: 'View transactions', url: appUrl('/wallet/transactions') },
    }),
  },
  'wallet.withdrawal-failed': {
    essential: true,
    subject: () => 'Your PlayStake withdrawal failed',
    content: (p) => ({
      eyebrow: 'Withdrawal',
      heading: 'That withdrawal could not be paid',
      name: p.name,
      paragraphs: [
        `Your payout of ${p.amount} was returned, and the money is back in your PlayStake balance.`,
        `Reason given by the payment provider: ${p.reason}`,
        'Check your payout details are correct, then try again.',
      ],
      cta: { label: 'Check payout details', url: appUrl('/wallet') },
    }),
  },
  // ----------------------------------------------------------------- matches
  'bet.settled': {
    essential: false,
    subject: (p) =>
      p.outcome === 'won'
        ? `You won ${p.netResult} — ${p.gameName}`
        : p.outcome === 'draw'
          ? `Match drawn — ${p.gameName}`
          : `Match settled — ${p.gameName}`,
    content: (p) => ({
      eyebrow: 'Match settled',
      heading:
        p.outcome === 'won'
          ? `You beat ${p.opponent}`
          : p.outcome === 'draw'
            ? `You drew with ${p.opponent}`
            : `${p.opponent} took that one`,
      name: p.name,
      paragraphs: [
        p.outcome === 'won'
          ? 'Your winnings are already in your balance.'
          : p.outcome === 'draw'
            ? 'Both stakes have been returned in full.'
            : 'Your stake has been paid to your opponent.',
      ],
      facts: [
        { label: 'Game', value: p.gameName },
        { label: 'Stake', value: p.stake },
        { label: p.outcome === 'lost' ? 'Result' : 'You received', value: p.netResult, accent: true },
        { label: 'New balance', value: p.balance },
      ],
      cta: { label: 'View match', url: bets(p.betId) },
      optional: true,
    }),
  },
  'bet.voided': {
    essential: true,
    subject: (p) => `Match voided — ${p.stake} refunded`,
    content: (p) => ({
      eyebrow: 'Match voided',
      heading: 'Your stake has been refunded',
      name: p.name,
      paragraphs: [
        `Your ${p.gameName} match was voided, so nobody won or lost.`,
        `Reason: ${p.reason}`,
        `${p.stake} is back in your balance.`,
      ],
      cta: { label: 'View match', url: bets(p.betId) },
    }),
  },
  'bet.dispute-filed': {
    essential: true,
    subject: (p) => `Match disputed — ${p.gameName}`,
    content: (p) => ({
      eyebrow: 'Dispute',
      heading: p.byOpponent ? 'Your opponent disputed the result' : 'Your dispute has been filed',
      name: p.name,
      paragraphs: [
        'Settlement is paused while our team reviews the match. Both stakes stay in escrow until it is resolved.',
        'We will email you as soon as there is a decision.',
      ],
      cta: { label: 'View match', url: bets(p.betId) },
    }),
  },
  'bet.dispute-resolved': {
    essential: true,
    subject: (p) => `Dispute resolved — ${p.gameName}`,
    content: (p) => ({
      eyebrow: 'Dispute',
      heading: 'Your dispute has been resolved',
      name: p.name,
      paragraphs: [`Outcome: ${p.outcome}`, 'Any funds owed have been moved to your balance.'],
      cta: { label: 'View match', url: bets(p.betId) },
    }),
  },
  'bet.referee-decision': {
    essential: true,
    subject: (p) => `Referee result — ${p.gameName}`,
    content: (p) => ({
      eyebrow: 'Referee decision',
      heading: 'The referee has recorded a result',
      name: p.name,
      paragraphs: [`Decision: ${p.decision}`],
      callout: `If you think this is wrong, open a dispute before ${p.disputeDeadline}. After that the result is final and funds are paid out.`,
      cta: { label: 'View match', url: bets(p.betId) },
    }),
  },
  // ---------------------------------------------------------------- referees
  'referee.application-received': {
    essential: true,
    subject: () => 'We have your referee application',
    content: (p) => ({
      eyebrow: 'Referee',
      heading: 'Application received',
      name: p.name,
      paragraphs: [
        'An admin will review your Kick channel, identity check and chosen games.',
        'We will email you with a decision.',
      ],
      cta: { label: 'Open Referee Hub', url: appUrl('/referee') },
    }),
  },
  'referee.application-decided': {
    essential: true,
    subject: (p) =>
      p.status === 'approved'
        ? 'You are approved to referee on PlayStake'
        : p.status === 'suspended'
          ? 'Your PlayStake referee access is suspended'
          : 'Your PlayStake referee application was not approved',
    content: (p) => ({
      eyebrow: 'Referee',
      heading:
        p.status === 'approved'
          ? 'You are an approved referee'
          : p.status === 'suspended'
            ? 'Your referee access is suspended'
            : 'Your application was not approved',
      name: p.name,
      paragraphs:
        p.status === 'approved'
          ? [
              'Set yourself available in the Referee Hub and you can claim matches on the games you picked.',
              'You earn 10% of the platform fee on every match you officiate.',
            ]
          : [
              ...(p.notes ? [`Notes from the reviewer: ${p.notes}`] : []),
              p.status === 'suspended'
                ? 'You cannot claim new matches while your access is suspended.'
                : 'You are welcome to apply again.',
            ],
      cta: { label: 'Open Referee Hub', url: appUrl('/referee') },
    }),
  },
  'referee.match-available': {
    essential: false,
    subject: (p) => `A ${p.gameName} match needs a referee`,
    content: (p) => ({
      eyebrow: 'Referee',
      heading: 'A match is waiting for you',
      name: p.name,
      paragraphs: [
        `${p.players} need an independent referee.`,
        'Matches are claimed first come, first served, and expire if nobody claims them within 10 minutes.',
      ],
      facts: [
        { label: 'Game', value: p.gameName },
        { label: 'Your fee', value: p.reward, accent: true },
      ],
      cta: { label: 'Claim this match', url: appUrl('/referee') },
      optional: true,
    }),
  },
  'referee.fee-paid': {
    essential: true,
    subject: (p) => `You earned ${p.amount} refereeing`,
    content: (p) => ({
      eyebrow: 'Referee',
      heading: 'Your referee fee has been paid',
      name: p.name,
      paragraphs: [`Thanks for officiating the ${p.gameName} match.`],
      facts: [
        { label: 'Fee earned', value: p.amount, accent: true },
        { label: 'New balance', value: p.balance },
      ],
      cta: { label: 'Open your wallet', url: appUrl('/wallet') },
    }),
  },
  // ------------------------------------------------------- responsible play
  'responsible.deposit-limit-changed': {
    essential: true,
    subject: (p) => `Your ${p.period.toLowerCase()} deposit limit is now ${p.amount}`,
    content: (p) => ({
      eyebrow: 'Responsible play',
      heading: 'Your deposit limit has changed',
      name: p.name,
      paragraphs: [
        p.effectiveAt
          ? `Your ${p.period.toLowerCase()} limit will change to ${p.amount} on ${p.effectiveAt}. Increases take effect after a cooling-off period; decreases apply immediately.`
          : `Your ${p.period.toLowerCase()} deposit limit is now ${p.amount}, effective immediately.`,
      ],
      cta: { label: 'Review your limits', url: appUrl('/responsible-play') },
    }),
  },
  'responsible.break-started': {
    essential: true,
    subject: (p) => `Your ${p.kind.toLowerCase()} has started`,
    content: (p) => ({
      eyebrow: 'Responsible play',
      heading: `Your ${p.kind.toLowerCase()} is active`,
      name: p.name,
      paragraphs: [
        p.endsAt
          ? `You will not be able to deposit or place bets until ${p.endsAt}.`
          : 'You will not be able to deposit or place bets until you contact support.',
        'Any funds in your balance remain yours and can be withdrawn.',
        'If gambling stops being fun, support is available at gamcare.org.uk or on 0808 8020 133.',
      ],
    }),
  },
  'responsible.break-ended': {
    essential: true,
    subject: () => 'Your PlayStake break has ended',
    content: (p) => ({
      eyebrow: 'Responsible play',
      heading: 'Your account is active again',
      name: p.name,
      paragraphs: [
        `Your ${p.kind.toLowerCase()} has ended, and you can deposit and play again.`,
        'You can start another break or set deposit limits at any time.',
      ],
      cta: { label: 'Review your settings', url: appUrl('/responsible-play') },
    }),
  },
  // ------------------------------------------------------------------- other
  'kick.connection-changed': {
    essential: false,
    subject: (p) => (p.connected ? 'Kick channel connected' : 'Kick channel disconnected'),
    content: (p) => ({
      eyebrow: 'Kick',
      heading: p.connected
        ? `${p.channel} is connected`
        : `${p.channel} has been disconnected`,
      name: p.name,
      paragraphs: [
        p.connected
          ? 'Your Kick channel is linked, so you can go live and take challenges.'
          : 'Your Kick channel is no longer linked. You will not receive challenges until you reconnect.',
      ],
      callout: p.connected ? undefined : 'If this was not you, reconnect and change your password.',
      cta: { label: 'Open PlayStake', url: appUrl('/dashboard') },
      optional: true,
    }),
  },
  'beta.signup-received': {
    essential: true,
    subject: () => 'You are on the PlayStake list',
    content: (p) => ({
      eyebrow: 'Welcome',
      heading: 'Thanks for signing up',
      name: p.name,
      paragraphs: [
        'We will email you as soon as your spot is ready.',
        'PlayStake is peer-to-peer wagering on your own matches, with an independent referee on every refereed game.',
      ],
      cta: { label: 'Visit PlayStake', url: appUrl('/') },
    }),
  },
  'admin.alert': {
    essential: true,
    subject: (p) => `[PlayStake] ${p.title}`,
    content: (p) => ({
      eyebrow: 'Admin',
      heading: p.title,
      paragraphs: [p.detail],
      ...(p.url ? { cta: { label: 'Open admin', url: p.url } } : {}),
    }),
  },
};

/** Whether a template always sends, regardless of the user's preference. */
export function isEssential(template: EmailTemplateName): boolean {
  return TEMPLATES[template].essential;
}

export function isKnownTemplate(template: string): template is EmailTemplateName {
  return template in TEMPLATES;
}

/** Render a stored outbox row (template name + payload) into a sendable email. */
export function renderEmail<N extends EmailTemplateName>(
  template: N,
  payload: Payloads[N],
): RenderedEmail {
  const definition = TEMPLATES[template] as TemplateDefinition<Payloads[N]>;
  const content = definition.content(payload);
  return {
    subject: definition.subject(payload),
    html: renderHtml(content),
    text: renderText(content),
  };
}

export const EMAIL_TEMPLATE_NAMES = Object.keys(TEMPLATES) as EmailTemplateName[];
