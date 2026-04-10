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
};

export default nextConfig;
