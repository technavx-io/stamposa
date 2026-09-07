'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ActorRole } from '../api/types';
import { sessionFor, StoredSession } from './session';

const getServerSnapshot = () => null;

export interface SessionState {
  session: StoredSession | null;
  /**
   * False during SSR and the hydration pass, where the session is always
   * null regardless of localStorage. Never make auth decisions (redirects,
   * inline login) until this is true — acting on the hydration snapshot
   * bounces users through login on every full page load.
   */
  ready: boolean;
}

/** Reactive view of a portal's stored session (cross-tab aware). */
export function useStoredSession(role: ActorRole): SessionState {
  const store = sessionFor(role);
  const session = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.get(),
    getServerSnapshot,
  );
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return { session, ready };
}
