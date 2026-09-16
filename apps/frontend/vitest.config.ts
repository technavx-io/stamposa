import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Frontend unit tests. Uses jsdom so localStorage / window / DOM APIs work;
 * React plugin so component tests can render JSX. Path aliases from
 * tsconfig.json are NOT wired here yet — write test files next to their
 * targets so imports stay relative.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // happy-dom for the browser env — smaller and faster than jsdom, and its
    // Storage API works out of the box (jsdom v27 in vitest 3 ships a broken
    // localStorage where .clear/.removeItem are missing).
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Same-name spec files inside a Next.js `app/` route can collide with
    // route conventions; keep tests colocated with the code they test.
    exclude: ['node_modules', '.next', 'dist'],
  },
});
