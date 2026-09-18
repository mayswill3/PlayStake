// =============================================================================
// PlayStake — Branded email layout
// =============================================================================
// Email clients strip <style> blocks and ignore most modern CSS, so every
// template is table-based with inline styles. Colours mirror design/tokens.css.
// =============================================================================

import { SITE_URL } from '@/lib/seo';

const BRAND = {
  lime: '#5FDCB2',
  ink: '#0A0F1C',
  ink2: '#111827',
  paper: '#FAFBFC',
  text: '#0A0F1C',
  muted: '#5B6473',
  border: '#E4E7EC',
  error: '#EF4444',
  warning: '#F59E0B',
} as const;

export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? SITE_URL;
  return new URL(path, `${base.replace(/\/$/, '')}/`).toString();
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!,
  );
}

/** A labelled value shown in the summary grid (e.g. Amount / New balance). */
export interface EmailFact {
  label: string;
  value: string;
  /** Renders the value in lime — use for the headline number. */
  accent?: boolean;
}

export interface EmailLayoutInput {
  /** Small uppercase line above the heading, e.g. "Deposit received". */
  eyebrow?: string;
  heading: string;
  /** Greeting name; omitted for emails to addresses with no account. */
  name?: string;
  /** Body paragraphs, plain text — escaped for the HTML version. */
  paragraphs: string[];
  facts?: EmailFact[];
  cta?: { label: string; url: string };
  /** Amber callout under the facts, e.g. a deadline or warning. */
  callout?: string;
  /** Adds the preferences link — set for optional (non-essential) emails. */
  optional?: boolean;
}

/**
 * The plain-text half of an email. Sent alongside the HTML for clients that
 * refuse HTML, and it keeps messages out of spam folders.
 */
export function renderText(input: EmailLayoutInput): string {
  const lines: string[] = [];
  if (input.name) lines.push(`Hi ${input.name},`, '');
  lines.push(input.heading, '');
  for (const paragraph of input.paragraphs) lines.push(paragraph, '');
  if (input.facts?.length) {
    for (const fact of input.facts) lines.push(`${fact.label}: ${fact.value}`);
    lines.push('');
  }
  if (input.callout) lines.push(input.callout, '');
  if (input.cta) lines.push(`${input.cta.label}: ${input.cta.url}`, '');
  lines.push('— PlayStake');
  if (input.optional) {
    lines.push('', `Manage which emails you receive: ${appUrl('/settings')}`);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The branded HTML half: dark header with the PlayStake logo, light body. */
export function renderHtml(input: EmailLayoutInput): string {
  const logoUrl = `${SITE_URL}/logo.png`;

  const eyebrow = input.eyebrow
    ? `<p style="margin:0 0 6px;font:700 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.lime};">${escapeHtml(input.eyebrow)}</p>`
    : '';

  const greeting = input.name
    ? `<p style="margin:0 0 16px;font:400 16px/1.6 Arial,Helvetica,sans-serif;color:${BRAND.text};">Hi ${escapeHtml(input.name)},</p>`
    : '';

  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font:400 16px/1.6 Arial,Helvetica,sans-serif;color:${BRAND.muted};">${escapeHtml(paragraph)}</p>`,
    )
    .join('');

  const facts = input.facts?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;border:1px solid ${BRAND.border};border-radius:10px;background:${BRAND.paper};">
        ${input.facts
          .map(
            (fact, index) => `<tr>
              <td style="padding:12px 16px;font:400 14px/1.4 Arial,Helvetica,sans-serif;color:${BRAND.muted};${index > 0 ? `border-top:1px solid ${BRAND.border};` : ''}">${escapeHtml(fact.label)}</td>
              <td align="right" style="padding:12px 16px;font:700 ${fact.accent ? '18px' : '14px'}/1.4 Arial,Helvetica,sans-serif;color:${fact.accent ? BRAND.lime : BRAND.text};${index > 0 ? `border-top:1px solid ${BRAND.border};` : ''}">${escapeHtml(fact.value)}</td>
            </tr>`,
          )
          .join('')}
      </table>`
    : '';

  const callout = input.callout
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;border-radius:10px;background:#FEF6E7;">
        <tr><td style="padding:14px 16px;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#7A4E00;">${escapeHtml(input.callout)}</td></tr>
      </table>`
    : '';

  // Bulletproof-ish button: a padded anchor survives every major client.
  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr><td align="center" style="border-radius:10px;background:${BRAND.lime};">
          <a href="${input.cta.url}" style="display:inline-block;padding:14px 28px;font:700 16px/1 Arial,Helvetica,sans-serif;color:${BRAND.ink};text-decoration:none;border-radius:10px;">${escapeHtml(input.cta.label)}</a>
        </td></tr>
      </table>`
    : '';

  const preferences = input.optional
    ? `<p style="margin:8px 0 0;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${BRAND.muted};">
        <a href="${appUrl('/settings')}" style="color:${BRAND.muted};">Manage which emails you receive</a>
      </p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F3F6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1F3F6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid ${BRAND.border};">
          <tr>
            <td style="padding:20px 24px;background:${BRAND.ink};">
              <img src="${logoUrl}" width="32" height="32" alt="PlayStake" style="vertical-align:middle;border:0;display:inline-block;">
              <span style="display:inline-block;vertical-align:middle;margin-left:10px;font:700 18px/1 Arial,Helvetica,sans-serif;color:#FFFFFF;">PlayStake</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              ${eyebrow}
              <h1 style="margin:0 0 18px;font:700 24px/1.3 Arial,Helvetica,sans-serif;color:${BRAND.text};">${escapeHtml(input.heading)}</h1>
              ${greeting}
              ${paragraphs}
              ${facts}
              ${callout}
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${BRAND.muted};">
                PlayStake · <a href="${appUrl('/')}" style="color:${BRAND.muted};">playstake.org</a><br>
                Questions? Reply to this email and we'll help.
              </p>
              ${preferences}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
