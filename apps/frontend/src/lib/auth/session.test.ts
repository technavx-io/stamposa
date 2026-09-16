import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from './session';
import type { StoredSession } from './session';
import type { SessionActor, Tokens } from '../api/types';

const tokens: Tokens = { accessToken: 'a', refreshToken: 'r', accessTokenExpiresInSec: 900 };
const actor: SessionActor = {
  id: 'm1',
  role: 'MERCHANT',
  name: 'Owner',
  email: null,
  phone: '+919876500001',
};
const session: StoredSession = { tokens, actor };

describe('SessionStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    const store = new SessionStore('MERCHANT');
    expect(store.get()).toBeNull();
  });

  it('round-trips a session through localStorage', () => {
    const store = new SessionStore('MERCHANT');
    store.set(session);
    expect(store.get()).toEqual(session);
    // Storage is the source of truth — a fresh store instance sees it too.
    expect(new SessionStore('MERCHANT').get()).toEqual(session);
  });

  it('keeps merchant, staff and customer sessions in separate keys', () => {
    const merchant = new SessionStore('MERCHANT');
    const staff = new SessionStore('STAFF');
    merchant.set(session);
    expect(merchant.get()).toEqual(session);
    expect(staff.get()).toBeNull();
  });

  it('clear() wipes the session', () => {
    const store = new SessionStore('MERCHANT');
    store.set(session);
    store.clear();
    expect(store.get()).toBeNull();
    expect(window.localStorage.getItem('loyalty.session.merchant')).toBeNull();
  });

  it('updateTokens() replaces tokens without touching the actor', () => {
    const store = new SessionStore('MERCHANT');
    store.set(session);
    const next: Tokens = { accessToken: 'a2', refreshToken: 'r2', accessTokenExpiresInSec: 900 };
    store.updateTokens(next);
    expect(store.get()?.tokens).toEqual(next);
    expect(store.get()?.actor).toEqual(actor);
  });

  it('updateTokens() is a no-op when there is no session', () => {
    const store = new SessionStore('MERCHANT');
    store.updateTokens({ accessToken: 'a', refreshToken: 'r', accessTokenExpiresInSec: 900 });
    expect(store.get()).toBeNull();
  });

  it('notifies subscribers on set() and clear()', () => {
    const store = new SessionStore('MERCHANT');
    let calls = 0;
    const unsub = store.subscribe(() => (calls += 1));
    store.set(session);
    store.clear();
    expect(calls).toBe(2);
    unsub();
    store.set(session);
    expect(calls).toBe(2);
  });

  it('recovers from corrupt localStorage entries', () => {
    window.localStorage.setItem('loyalty.session.merchant', '{ this is not JSON');
    const store = new SessionStore('MERCHANT');
    expect(store.get()).toBeNull();
  });
});
