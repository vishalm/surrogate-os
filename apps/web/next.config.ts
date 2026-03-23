import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@surrogate-os/shared'],
};

export default nextConfig;
