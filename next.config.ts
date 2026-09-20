import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  output: 'standalone',
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

      // Old /demo route migrated to /play
      { source: '/demo', destination: '/play', permanent: true },
      { source: '/demo/:path*', destination: '/play/:path*', permanent: true },
    ];
  },
  async headers() {
    const noIndexHeaders = [
      {
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow, noarchive',
      },
    ];

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
      silent: true,
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    })
  : nextConfig;
