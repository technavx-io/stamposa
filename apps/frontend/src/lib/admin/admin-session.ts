'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AdminCapability, AdminProfile, AdminTokens } from '../api/admin-types';

const KEY = 'loyalty.session.admin';

export interface StoredAdminSession {
  tokens: AdminTokens;
  admin: AdminProfile;
}

type Listener = () => void;

/**
 * Admin session lives under its own key, separate from the three tenant
 * sessions, so an operator can hold an admin session and an impersonated
 * merchant session in the same browser without either clobbering the other.
 */
class AdminSessionStore {
  private listeners = new Set<Listener>();
  private cache: StoredAdminSession | null | undefined;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === KEY) {
          this.cache = undefined;
          this.emit();
        }
      });
    }
  }

  get(): StoredAdminSession | null {
    if (typeof window === 'undefined') return null;
    if (this.cache !== undefined) return this.cache;
    try {
      const raw = window.localStorage.getItem(KEY);
      this.cache = raw ? (JSON.parse(raw) as StoredAdminSession) : null;
    } catch {
      this.cache = null;
    }
    return this.cache;
  }

  set(session: StoredAdminSession): void {
    this.cache = session;
    window.localStorage.setItem(KEY, JSON.stringify(session));
    this.emit();
  }

  updateTokens(tokens: AdminTokens): void {
    const current = this.get();
    if (current) this.set({ ...current, tokens });
  }

  clear(): void {
    this.cache = null;
    window.localStorage.removeItem(KEY);
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}

export const adminSession = new AdminSessionStore();

const getServerSnapshot = () => null;

/**
 * `ready` is false during SSR and hydration, when the session always reads
 * as null. Never redirect before it flips true.
 */
export function useAdminSession(): { session: StoredAdminSession | null; ready: boolean } {
  const session = useSyncExternalStore(
    (cb) => adminSession.subscribe(cb),
    () => adminSession.get(),
    getServerSnapshot,
  );
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return { session, ready };
}

/** True when the signed-in admin's role holds this capability. */
export function useCan(capability: AdminCapability): boolean {
  const { session } = useAdminSession();
  return session?.admin.capabilities.includes(capability) ?? false;
}
