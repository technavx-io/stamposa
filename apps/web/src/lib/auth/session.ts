import type { ActorRole, SessionActor, Tokens } from '../api/types';

export interface StoredSession {
  tokens: Tokens;
  actor: SessionActor;
}

type Listener = () => void;

/**
 * One session per portal, stored under separate localStorage keys, so the
 * same browser can be merchant + staff + customer simultaneously (handy in
 * demos and at solo-owner counters).
 *
 * Trade-off (documented in the README): tokens in localStorage are readable
 * by same-origin JS. Access tokens are short-lived and refresh tokens are
 * server-revocable; a Phase 2 hardening step is httpOnly cookie sessions.
 */
export class SessionStore {
  private readonly key: string;
  private listeners = new Set<Listener>();
  private cache: StoredSession | null | undefined;

  constructor(role: ActorRole) {
    this.key = `loyalty.session.${role.toLowerCase()}`;
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === this.key) {
          this.cache = undefined;
          this.emit();
        }
      });
    }
  }

  get(): StoredSession | null {
    if (typeof window === 'undefined') return null;
    if (this.cache !== undefined) return this.cache;
    try {
      const raw = window.localStorage.getItem(this.key);
      this.cache = raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      this.cache = null;
    }
    return this.cache;
  }

  set(session: StoredSession): void {
    this.cache = session;
    window.localStorage.setItem(this.key, JSON.stringify(session));
    this.emit();
  }

  updateTokens(tokens: Tokens): void {
    const current = this.get();
    if (current) this.set({ ...current, tokens });
  }

  clear(): void {
    this.cache = null;
    window.localStorage.removeItem(this.key);
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

export const merchantSession = new SessionStore('MERCHANT');
export const staffSession = new SessionStore('STAFF');
export const customerSession = new SessionStore('CUSTOMER');

export function sessionFor(role: ActorRole): SessionStore {
  switch (role) {
    case 'MERCHANT':
      return merchantSession;
    case 'STAFF':
      return staffSession;
    case 'CUSTOMER':
      return customerSession;
  }
}
