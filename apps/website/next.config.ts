import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Monorepo root (avoids Turbopack picking up unrelated lockfiles).
  turbopack: {
    root: path.join(__dirname, '..', '..'),
  },
  // The design system is plain TypeScript in packages/ui; compile it here.
  transpilePackages: ['@stamposa/ui'],
  // Self-contained server bundle for the production Docker image.
  output: 'standalone',
  async redirects() {
    return [
      // Dodo Payments and outside references may point at the singular URL;
      // keep the canonical page plural and 308-redirect the singular here.
      { source: '/legal/refund', destination: '/legal/refunds', permanent: true },
    ];
  },
};

export default nextConfig;
