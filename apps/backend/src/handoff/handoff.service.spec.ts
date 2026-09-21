import { DomainException } from '../common/exceptions';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TokenService } from '../auth/token.service';
import { AuthActor } from '../auth/auth.types';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { HandoffController } from './handoff.controller';
import { HandoffService, isSafeGoto } from './handoff.service';

interface FakeMerchant {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  emailVerifiedAt: Date | null;
  business: { id: string; slug: string; suspendedAt: Date | null } | null;
}

function makeMerchant(overrides: Partial<FakeMerchant> = {}): FakeMerchant {
  return {
    id: 'm_1',
    email: 'owner@example.test',
    name: 'Owner',
    phone: null,
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    business: null,
    ...overrides,
  };
}

/**
 * A minimal in-memory Redis that supports the four operations the service
 * uses (setWithTtl, raw.getdel, get, TTL expiry). Real ioredis semantics are
 * tested by the integration suite; here we just need atomic GETDEL and a TTL
 * we can advance with fake timers.
 */
function makeRedis() {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const gcExpired = (): void => {
    const now = Date.now();
    for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
  };
  const raw = {
    getdel: jest.fn(async (key: string) => {
      gcExpired();
      const entry = store.get(key);
      if (!entry) return null;
      store.delete(key);
      return entry.value;
    }),
  };
  const svc = {
    raw,
    get: jest.fn(async (key: string) => {
      gcExpired();
      return store.get(key)?.value ?? null;
    }),
    setWithTtl: jest.fn(async (key: string, value: string, ttlSec: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
    }),
    _store: store,
  };
  return svc;
}

function makeService(opts: { merchant?: FakeMerchant | null } = {}) {
  const merchant: FakeMerchant = opts.merchant === undefined || opts.merchant === null
    ? makeMerchant()
    : opts.merchant;
  const redis = makeRedis();
  const prisma = {
    merchant: {
      findUnique: jest.fn<Promise<FakeMerchant | null>, unknown[]>(async () => merchant),
    },
  };
  const tokens = {
    issueSession: jest.fn(async (_role: string, actorId: string) => ({
      accessToken: `access-${actorId}`,
      refreshToken: `refresh-${actorId}`,
      accessTokenExpiresInSec: 900,
    })),
  };
  const config = {
    apiPublicUrl: 'https://api.example.test',
    webAppUrl: 'https://app.example.test',
  };

  const service = new HandoffService(
    redis as unknown as RedisService,
    tokens as unknown as TokenService,
    prisma as unknown as PrismaService,
    config as unknown as AppConfigService,
  );
  return { service, redis, prisma, tokens, merchant };
}

function merchantActor(merchant: FakeMerchant): AuthActor {
  return {
    role: 'MERCHANT',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    merchant: merchant as any,
  };
}

async function expectDomain(promise: Promise<unknown>): Promise<DomainException> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainException);
    return e as DomainException;
  }
  throw new Error('Expected promise to reject with DomainException, but it resolved.');
}

describe('HandoffController metadata', () => {
  it('declares a 5-per-60s throttler on the generate endpoint', () => {
    // @nestjs/throttler stores metadata keyed as `${THROTTLER_LIMIT}${name}`
    // on the method descriptor's value. We check the "default" throttler
    // this app uses.
    const limit = Reflect.getMetadata(
      `${THROTTLER_LIMIT}default`,
      HandoffController.prototype.create,
    );
    const ttl = Reflect.getMetadata(
      `${THROTTLER_TTL}default`,
      HandoffController.prototype.create,
    );
    expect(limit).toBe(5);
    expect(ttl).toBe(60_000);
  });
});

describe('HandoffService', () => {
  describe('isSafeGoto', () => {
    it('accepts a bare in-app path with a fragment', () => {
      expect(isSafeGoto('/merchant/settings#menu-pdf')).toBe(true);
    });
    it('rejects protocol-relative and absolute URLs', () => {
      expect(isSafeGoto('//evil.example')).toBe(false);
      expect(isSafeGoto('https://evil.example/x')).toBe(false);
    });
    it('rejects missing leading slash and empty strings', () => {
      expect(isSafeGoto('merchant/settings')).toBe(false);
      expect(isSafeGoto('')).toBe(false);
    });
    it('rejects paths with whitespace or backslashes', () => {
      expect(isSafeGoto('/foo bar')).toBe(false);
      expect(isSafeGoto('/foo\\bar')).toBe(false);
    });
  });

  describe('generate', () => {
    it('mints a 32-byte hex token, stores it with a 5-minute TTL, and returns an SVG QR', async () => {
      const { service, redis } = makeService();
      const merchant = makeMerchant();
      const result = await service.generate(merchantActor(merchant));

      expect(result.token).toMatch(/^[a-f0-9]{64}$/);
      expect(result.expiresInSec).toBe(300);
      expect(result.qrSvg.startsWith('<?xml') || result.qrSvg.startsWith('<svg')).toBe(true);
      expect(result.url).toContain('https://app.example.test/merchant/handoff?');
      expect(result.url).toContain(`token=${result.token}`);
      expect(result.url).toContain('goto=%2Fmerchant%2Fsettings%23menu-pdf');

      expect(redis.setWithTtl).toHaveBeenCalledTimes(1);
      const [key, value, ttl] = redis.setWithTtl.mock.calls[0];
      expect(key).toBe(`handoff:merchant:${result.token}`);
      expect(JSON.parse(value)).toEqual({ merchantId: merchant.id });
      expect(ttl).toBe(300);
    });

    it('rejects an unsafe goto server-side (protocol-relative)', async () => {
      const { service } = makeService();
      const err = await expectDomain(
        service.generate(merchantActor(makeMerchant()), '//evil.example/x'),
      );
      expect(err.getStatus()).toBe(400);
      expect(err.getResponse()).toMatchObject({ code: 'HANDOFF_INVALID_GOTO' });
    });
  });

  describe('consume', () => {
    it('returns a merchant session envelope shaped like /auth/login', async () => {
      const { service, tokens, merchant } = makeService();
      const gen = await service.generate(merchantActor(merchant));

      const session = await service.consume(gen.token);

      expect(tokens.issueSession).toHaveBeenCalledWith('MERCHANT', merchant.id);
      expect(session).toEqual({
        tokens: {
          accessToken: `access-${merchant.id}`,
          refreshToken: `refresh-${merchant.id}`,
          accessTokenExpiresInSec: 900,
        },
        actor: {
          id: merchant.id,
          role: 'MERCHANT',
          name: merchant.name,
          email: merchant.email,
          phone: merchant.phone,
        },
        business: null,
      });
    });

    it('is single-use: consuming the same token twice fails the second call', async () => {
      const { service, merchant } = makeService();
      const gen = await service.generate(merchantActor(merchant));

      await service.consume(gen.token);
      const err = await expectDomain(service.consume(gen.token));
      expect(err.getStatus()).toBe(400);
      expect(err.getResponse()).toMatchObject({ code: 'HANDOFF_INVALID' });
    });

    it('atomically GETDELs the Redis key so it cannot be replayed', async () => {
      const { service, redis, merchant } = makeService();
      const gen = await service.generate(merchantActor(merchant));
      await service.consume(gen.token);
      expect(redis.raw.getdel).toHaveBeenCalledWith(`handoff:merchant:${gen.token}`);
      expect(redis._store.has(`handoff:merchant:${gen.token}`)).toBe(false);
    });

    it('rejects an expired token (TTL past)', async () => {
      jest.useFakeTimers();
      try {
        const { service, merchant } = makeService();
        const gen = await service.generate(merchantActor(merchant));
        jest.setSystemTime(Date.now() + 301_000); // 301s later, past the 300s TTL
        const err = await expectDomain(service.consume(gen.token));
        expect(err.getStatus()).toBe(400);
        expect(err.getResponse()).toMatchObject({ code: 'HANDOFF_INVALID' });
      } finally {
        jest.useRealTimers();
      }
    });

    it('rejects malformed tokens without touching Redis', async () => {
      const { service, redis } = makeService();
      const err = await expectDomain(service.consume('not-a-hex-token'));
      expect(err.getStatus()).toBe(400);
      expect(err.getResponse()).toMatchObject({ code: 'HANDOFF_INVALID' });
      expect(redis.raw.getdel).not.toHaveBeenCalled();
    });

    it('refuses when the merchant no longer exists (leaks nothing distinct)', async () => {
      const { service, prisma, merchant } = makeService();
      const gen = await service.generate(merchantActor(merchant));
      prisma.merchant.findUnique.mockResolvedValueOnce(null);
      const err = await expectDomain(service.consume(gen.token));
      expect(err.getResponse()).toMatchObject({ code: 'HANDOFF_INVALID' });
    });
  });
});
