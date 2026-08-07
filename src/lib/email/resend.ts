import { SITE_URL } from '@/lib/seo';

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[
        character
      ]!,
  );
}

async function sendEmail(input: EmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'PlayStake <support@playstake.org>',
      reply_to: 'support@playstake.org',
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${responseText}`);
  }
}

function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? SITE_URL;
  return new URL(path, `${base.replace(/\/$/, '')}/`).toString();
}

export async function sendVerificationEmail(input: {
  email: string;
  displayName: string;
  token: string;
  tokenId: string;
}) {
  const url = appUrl(`/verify-email?token=${encodeURIComponent(input.token)}`);
  const name = escapeHtml(input.displayName);

  return sendEmail({
    to: input.email,
    subject: 'Verify your PlayStake email',
    idempotencyKey: `verify-${input.tokenId}`,
    text: `Hi ${input.displayName}, verify your PlayStake email: ${url}. This link expires in 24 hours.`,
    html: `<p>Hi ${name},</p><p>Verify your PlayStake email address:</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail(input: {
  email: string;
  displayName: string;
  token: string;
  tokenId: string;
}) {
  const url = appUrl(`/reset-password?token=${encodeURIComponent(input.token)}`);
  const name = escapeHtml(input.displayName);

  return sendEmail({
    to: input.email,
    subject: 'Reset your PlayStake password',
    idempotencyKey: `reset-${input.tokenId}`,
    text: `Hi ${input.displayName}, reset your PlayStake password: ${url}. This link expires in one hour.`,
    html: `<p>Hi ${name},</p><p>Use this secure link to reset your PlayStake password:</p><p><a href="${url}">Reset password</a></p><p>This link expires in one hour and can only be used once. If you did not request it, you can ignore this email.</p>`,
  });
}
