// =============================================================================
// PlayStake — Email senders
// =============================================================================
// Thin helpers over the outbox: callers describe the event, a row is written,
// and the email-delivery worker sends it. Nothing here performs network I/O, so
// an email can never slow down or fail a request.
//
// Templates and copy live in ./templates; the branded layout in ./layout.
// =============================================================================

import { queueEmail } from './outbox';
import { appUrl } from './layout';

export async function sendVerificationEmail(input: {
  email: string;
  displayName: string;
  token: string;
  tokenId: string;
  userId?: string;
}) {
  return queueEmail({
    template: 'auth.verify-email',
    dedupeKey: `verify-${input.tokenId}`,
    toEmail: input.email,
    userId: input.userId,
    payload: {
      name: input.displayName,
      url: appUrl(`/verify-email?token=${encodeURIComponent(input.token)}`),
    },
  });
}

export async function sendPasswordResetEmail(input: {
  email: string;
  displayName: string;
  token: string;
  tokenId: string;
  userId?: string;
}) {
  return queueEmail({
    template: 'auth.password-reset',
    dedupeKey: `reset-${input.tokenId}`,
    toEmail: input.email,
    userId: input.userId,
    payload: {
      name: input.displayName,
      url: appUrl(`/reset-password?token=${encodeURIComponent(input.token)}`),
    },
  });
}

export async function sendKycDecisionEmail(input: {
  email: string;
  displayName: string;
  submissionId: string;
  approved: boolean;
  reviewNotes?: string | null;
  userId?: string;
}) {
  return input.approved
    ? queueEmail({
        template: 'kyc.approved',
        dedupeKey: `kyc-approved-${input.submissionId}`,
        toEmail: input.email,
        userId: input.userId,
        payload: { name: input.displayName },
      })
    : queueEmail({
        template: 'kyc.rejected',
        dedupeKey: `kyc-rejected-${input.submissionId}`,
        toEmail: input.email,
        userId: input.userId,
        payload: { name: input.displayName, reviewNotes: input.reviewNotes ?? null },
      });
}
