import type { ActorRole, SessionActor, Tokens } from '../api/types';

export interface StoredSession {
  tokens: Tokens;
  actor: SessionActor;
}

/** Per-role sessionStorage key set by SessionStore when another tab logs out. */
function signedOutElsewhereKey(role: ActorRole): string {
  return `stamposa.signed-out-elsewhere.${role.toLowerCase()}`;
}

/**
 * Was this tab's session cleared by ANOTHER tab (cross-tab logout)?
 * Login pages call this on mount to decide whether to show a soft-logout
 * toast. Reading the flag also consumes it, so it fires exactly once.
 */
export function consumeSignedOutElsewhere(role: ActorRole): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = signedOutElsewhereKey(role);
    const was = window.sessionStorage.getItem(key) === '1';
    if (was) window.sessionStorage.removeItem(key);
    return was;
  } catch {
    return false;
  }
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
        if (e.key !== this.key) return;
        // Bug #13 (soft-logout): another tab cleared this session. Leave a
        // per-tab marker in sessionStorage so the login page can show a toast
        // ("Signed out in another tab") rather than silently redirecting.
        // Only fires on a real remote clear — a set-then-set (token refresh)
        // has a non-null newValue and stays silent.
        if (e.newValue === null && e.oldValue !== null) {
          try {
            window.sessionStorage.setItem(signedOutElsewhereKey(role), '1');
          } catch {
            // sessionStorage can throw in private mode; toast is a nice-to-have.
          }
        }
        this.cache = undefined;
        this.emit();
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
