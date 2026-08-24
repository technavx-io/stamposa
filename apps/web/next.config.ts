import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Monorepo root (avoids Turbopack picking up unrelated lockfiles).
  turbopack: {
    root: path.join(__dirname, '..', '..'),
  },
  // Self-contained server bundle for the production Docker image. Netlify
  // ships its own Next runtime and needs the default output, so skip it
  // there (Netlify sets NETLIFY=true during builds).
  ...(process.env.NETLIFY ? {} : { output: 'standalone' as const }),
};

export default nextConfig;
