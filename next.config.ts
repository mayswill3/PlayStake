import type { NextConfig } from 'next';

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

    return [
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

export default nextConfig;
