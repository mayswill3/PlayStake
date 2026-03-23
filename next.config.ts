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
};

export default nextConfig;
