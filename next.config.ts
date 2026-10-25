import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  output: 'standalone',
  // AVIF is about a fifth smaller than WebP for photos; WebP is the fallback.
  images: { formats: ['image/avif', 'image/webp'] },
  // One id per deploy (Railway's commit SHA, available at build time). A tab
  // left open across a deploy then does a full reload on its next navigation,
  // instead of asking the new server for data in the old build's format.
  deploymentId: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) || undefined,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/widget',
        destination: '/widget/index.html',
      },
    ];
  },
  async redirects() {
    return [
      // Canonicalise onto the apex domain. Session cookies are set without a
      // Domain attribute, so they are host-only: a session started on
      // www.playstake.org is invisible to playstake.org and vice versa. That
      // silently breaks anything that round-trips through an external service
      // and returns to the apex — Kick OAuth linking most of all.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.(?<domain>.*)' }],
        destination: 'https://:domain/:path*',
        permanent: true,
      },

      // PlayStake's own on-site games (Tic-Tac-Toe, Darts 301) were withdrawn;
      // every match is now a refereed stream match. Send old links to the games.
      { source: '/demo', destination: '/games', permanent: true },
      { source: '/demo/:path*', destination: '/games', permanent: true },
      { source: '/play', destination: '/games', permanent: true },
      { source: '/play/:path*', destination: '/games', permanent: true },
    ];
  },
  async headers() {
    const noIndexHeaders = [
      {
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow, noarchive',
      },
    ];

    // Content Security Policy. Next.js App Router emits inline bootstrap
    // scripts, so script-src needs 'unsafe-inline' until we move to per-request
    // nonces; everything else is pinned to the origins we actually use.
    const isDev = process.env.NODE_ENV !== 'production';
    const csp = (frameAncestors: string) =>
      [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        // Kick thumbnails and avatars come from several CDNs.
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: https:",
        `connect-src 'self' https://api.stripe.com https://*.sentry.io${isDev ? ' ws: wss:' : ''}`,
        'frame-src https://js.stripe.com https://hooks.stripe.com https://player.kick.com',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        `frame-ancestors ${frameAncestors}`,
        ...(isDev ? [] : ['upgrade-insecure-requests']),
      ].join('; ');

    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      },
    ];

    return [
      { source: '/:path*', headers: securityHeaders },
      // Nothing may frame PlayStake (clickjacking)...
      {
        source: '/((?!widget).*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp("'none'") },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      // ...except the in-game widget, which game developers embed by design.
      { source: '/widget', headers: [{ key: 'Content-Security-Policy', value: csp('*') }] },
      { source: '/widget/:path*', headers: [{ key: 'Content-Security-Policy', value: csp('*') }] },
      { source: '/api/:path*', headers: noIndexHeaders },
      { source: '/admin/:path*', headers: noIndexHeaders },
      { source: '/dashboard/:path*', headers: noIndexHeaders },
      { source: '/bets/:path*', headers: noIndexHeaders },
      { source: '/wallet/:path*', headers: noIndexHeaders },
      { source: '/challenges/:path*', headers: noIndexHeaders },
      { source: '/settings/:path*', headers: noIndexHeaders },
      { source: '/referee/:path*', headers: noIndexHeaders },
      { source: '/streams/:path*', headers: noIndexHeaders },
    ];
  },
};

// Only wrap the build when Sentry is actually configured. Without a DSN the
// wrapper's source-map upload has nothing to talk to, and an unconfigured
// deploy should build exactly as it did before.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Source maps are uploaded only when an auth token is present, and are
      // hidden from the client bundle so stack traces stay readable in Sentry
      // without publishing our source to anyone who opens devtools.
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Ties uploaded source maps to the deploy that produced them, so a stack
      // trace resolves against the right build rather than the newest one.
      release: {
        name: process.env.SENTRY_RELEASE ?? process.env.RAILWAY_GIT_COMMIT_SHA,
      },
      silent: true,
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    })
  : nextConfig;
