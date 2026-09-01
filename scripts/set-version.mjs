#!/usr/bin/env node
/**
 * Set the product version across the workspace in one step.
 *
 *   npm run version:set -- 0.2.0
 *
 * The API and the web app always carry the SAME version. They are deployed as
 * a pair and their contract (route shapes, auth flows) moves together, so
 * letting them drift apart would make "which version is live?" unanswerable —
 * which is the entire point of stamping a version in the first place.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: npm run version:set -- <semver>   e.g. 0.2.0 or 1.0.0-rc.1');
  process.exit(1);
}

for (const rel of ['package.json', 'apps/api/package.json', 'apps/web/package.json']) {
  const path = join(root, rel);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  const previous = pkg.version;
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`  ${rel.padEnd(24)} ${previous} → ${version}`);
}

console.log(`\nNow: git commit, then tag with  git tag v${version}`);
