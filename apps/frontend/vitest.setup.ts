import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Node 22+ ships a stub `globalThis.localStorage` that has no setItem /
 * getItem / clear (they require the CLI flag `--localstorage-file <path>`).
 * That stub shadows the Storage that happy-dom / jsdom install. Rewire both
 * globals to an in-memory Storage before every test so tests behave the
 * same on any Node version.
 */
function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    key(i) { return Array.from(store.keys())[i] ?? null; },
    getItem(k) { return store.get(k) ?? null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
  } as Storage;
}

beforeEach(() => {
  const local = createStorage();
  const session = createStorage();
  Object.defineProperty(window, 'localStorage', {
    value: local,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: session,
    writable: true,
    configurable: true,
  });
  (globalThis as unknown as { localStorage: Storage }).localStorage = local;
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = session;
});

// React Testing Library leaves the last-rendered tree in the DOM between
// tests; that leaks state across cases. Tear it down after each.
afterEach(() => cleanup());
