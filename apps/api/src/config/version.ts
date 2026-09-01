import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What is actually running, so a deploy can be verified rather than assumed.
 *
 * `version` is the product version from package.json — the same number across
 * the API and the web app, bumped together via `npm run version:set`. The
 * commit and build timestamp are injected at build time; they are what tell
 * you whether the container in front of you is the build you just shipped.
 *
 * Everything degrades to 'unknown' rather than throwing: a missing build stamp
 * should never be the reason the health endpoint fails.
 */
function packageVersion(): string {
  try {
    const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export const BUILD_INFO = {
  version: process.env.APP_VERSION || packageVersion(),
  commit: process.env.GIT_SHA || 'unknown',
  builtAt: process.env.BUILT_AT || 'unknown',
} as const;
