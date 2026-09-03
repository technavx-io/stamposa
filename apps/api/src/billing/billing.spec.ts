import { Subscription } from '@prisma/client';
import { effectiveTier, entitlementsOf } from './entitlements.service';
import { toStateDto } from './subscription.service';
import { PLANS, ALL_PLANS } from './plans';

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 's1',
    businessId: 'b1',
    plan: 'GROWTH',
    interval: 'MONTHLY',
    status: 'ACTIVE',
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    gatewayCustomerId: null,
    gatewaySubscriptionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Subscription;
}

const future = () => new Date(Date.now() + 5 * 86400_000);
const past = () => new Date(Date.now() - 86400_000);

describe('effectiveTier', () => {
  it('treats no subscription as FREE', () => {
    expect(effectiveTier(null)).toBe('FREE');
  });

  it('grants GROWTH during an active trial', () => {
    expect(effectiveTier(sub({ status: 'TRIALING', plan: 'FREE', trialEndsAt: future() }))).toBe(
      'GROWTH',
    );
  });

  it('drops to FREE the moment the trial lapses, even before a job flips it', () => {
    expect(effectiveTier(sub({ status: 'TRIALING', trialEndsAt: past() }))).toBe('FREE');
  });

  it('honours the plan for ACTIVE and during PAST_DUE grace', () => {
    expect(effectiveTier(sub({ status: 'ACTIVE', plan: 'PRO' }))).toBe('PRO');
    expect(effectiveTier(sub({ status: 'PAST_DUE', plan: 'STARTER' }))).toBe('STARTER');
  });

  it('keeps a canceled plan until the period ends, then FREE', () => {
    expect(effectiveTier(sub({ status: 'CANCELED', plan: 'GROWTH', currentPeriodEnd: future() }))).toBe('GROWTH');
    expect(effectiveTier(sub({ status: 'CANCELED', plan: 'GROWTH', currentPeriodEnd: past() }))).toBe('FREE');
  });

  it('treats EXPIRED as FREE', () => {
    expect(effectiveTier(sub({ status: 'EXPIRED', plan: 'PRO' }))).toBe('FREE');
  });
});

describe('entitlementsOf', () => {
  it('maps the effective tier to its limits', () => {
    const e = entitlementsOf(sub({ status: 'TRIALING', trialEndsAt: future() }));
    expect(e.tier).toBe('GROWTH');
    expect(e.limits.broadcastsPerMonth).toBe(30);
    expect(entitlementsOf(null).limits.broadcastsPerMonth).toBe(0);
  });
});

describe('toStateDto', () => {
  it('reports trial days left while trialing', () => {
    const dto = toStateDto(sub({ status: 'TRIALING', plan: 'GROWTH', trialEndsAt: future() }));
    expect(dto.status).toBe('TRIALING');
    expect(dto.effectiveTier).toBe('GROWTH');
    expect(dto.trialDaysLeft).toBeGreaterThan(0);
  });

  it('defaults a missing subscription to FREE/EXPIRED', () => {
    const dto = toStateDto(null);
    expect(dto.plan).toBe('FREE');
    expect(dto.effectiveTier).toBe('FREE');
  });
});

describe('plan catalog', () => {
  it('matches the locked pricing (paise) and broadcast caps', () => {
    expect(PLANS.FREE.price.monthly).toBe(0);
    expect(PLANS.STARTER.price.monthly).toBe(19900);
    expect(PLANS.GROWTH.price.monthly).toBe(49900);
    expect(PLANS.PRO.price.monthly).toBe(99900);
    expect(PLANS.FREE.limits.broadcastsPerMonth).toBe(0);
    expect(PLANS.STARTER.limits.broadcastsPerMonth).toBe(2);
    expect(PLANS.GROWTH.limits.broadcastsPerMonth).toBe(30);
    expect(PLANS.PRO.limits.broadcastsPerMonth).toBeNull();
  });

  it('recommends exactly one plan', () => {
    expect(ALL_PLANS.filter((p) => p.recommended)).toHaveLength(1);
  });
});
