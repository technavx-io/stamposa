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
};

export default nextConfig;
