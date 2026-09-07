import { CampaignStatus, StampIssuerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { WalletService } from '../wallet/wallet.service';
import { RedemptionsService } from './redemptions.service';
import { StampsService } from './stamps.service';

const BUSINESS_ID = 'biz_1';
const MEMBERSHIP_ID = 'mem_1';

interface FakeState {
  stampCount: number;
  completedCount: number;
  totalStamps: number;
  campaignStatus: CampaignStatus;
  stampsRequired: number;
}

/**
 * Stateful stand-in for the Prisma transaction client. Single-threaded, so
 * atomic-update semantics match Postgres row-level behaviour for these tests.
 */
function makeFakePrisma(state: FakeState) {
  const campaign = () => ({
    id: 'camp_1',
    businessId: BUSINESS_ID,
    name: 'Card',
    description: null,
    stampsRequired: state.stampsRequired,
    reward: 'Free coffee',
    status: state.campaignStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const membership = () => ({
    id: MEMBERSHIP_ID,
    code: 'AAAA2222',
    customerId: 'cust_1',
    businessId: BUSINESS_ID,
    campaignId: 'camp_1',
    stampCount: state.stampCount,
    completedCount: state.completedCount,
    totalStamps: state.totalStamps,
    lastStampAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const customer = () => ({
    id: 'cust_1',
    phone: '+919876501101',
    name: 'Aarav Shah',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createdStamps: Array<{ completedCard: boolean }> = [];

  const tx = {
    customerMembership: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.id === MEMBERSHIP_ID && where.businessId === BUSINESS_ID
          ? { ...membership(), campaign: campaign() }
          : null,
      ),
      update: jest.fn(async () => {
        state.stampCount += 1;
        state.totalStamps += 1;
        return membership();
      }),
      updateMany: jest.fn(async ({ where }: any) => {
        if (state.stampCount >= where.stampCount.gte) {
          state.stampCount -= where.stampCount.gte;
          state.completedCount += 1;
          return { count: 1 };
        }
        return { count: 0 };
      }),
      findUniqueOrThrow: jest.fn(async () => ({
        ...membership(),
        customer: customer(),
        campaign: campaign(),
      })),
    },
    stamp: {
      create: jest.fn(async ({ data }: any) => {
        createdStamps.push({ completedCard: data.completedCard });
        return {
          id: `stamp_${createdStamps.length}`,
          membershipId: MEMBERSHIP_ID,
          businessId: BUSINESS_ID,
          issuerType: data.issuerType,
          staffId: data.staffId,
          completedCard: data.completedCard,
          createdAt: new Date(),
          staff: data.staffId
            ? { id: data.staffId, name: 'Ravi Kumar', phone: '+919876500002' }
            : null,
        };
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  };

  return { prisma, tx, createdStamps };
}

function makeFakeRedis(acquire = true) {
  return {
    setIfAbsent: jest.fn().mockResolvedValue(acquire),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeFakeRedemptions() {
  return {
    createForCompletion: jest.fn(async (_tx: unknown, p: Record<string, string>) => ({
      id: 'red_1',
      code: 'RX7K9QZ2',
      membershipId: p.membershipId,
      businessId: p.businessId,
      rewardText: p.rewardText,
      earnedByStampId: p.earnedByStampId,
      status: 'PENDING',
      redeemedAt: null,
      redeemedByType: null,
      redeemedStaffId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
}

function makeFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

function makeFakeWallet() {
  return { cardChanged: jest.fn(async () => undefined) };
}

describe('StampsService', () => {
  it('adds a stamp without completing the card', async () => {
    const state: FakeState = {
      stampCount: 3,
      completedCount: 0,
      totalStamps: 3,
      campaignStatus: CampaignStatus.ACTIVE,
      stampsRequired: 10,
    };
    const { prisma } = makeFakePrisma(state);
    const redis = makeFakeRedis();
    const service = new StampsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      makeFakeRedemptions() as unknown as RedemptionsService,
      makeFakeAudit() as unknown as AuditService,
      makeFakeWallet() as unknown as WalletService,
    );

    const result = await service.addStamp({
      businessId: BUSINESS_ID,
      membershipId: MEMBERSHIP_ID,
      issuerType: StampIssuerType.STAFF,
      staffId: 'staff_1',
    });

    expect(result.rewardEarned).toBe(false);
    expect(result.redemption).toBeNull();
    expect(state.stampCount).toBe(4);
    expect(state.totalStamps).toBe(4);
    expect(result.stamp.issuerName).toBe('Ravi Kumar');
  });

  it('completes the card exactly at the threshold and resets the counter', async () => {
    const state: FakeState = {
      stampCount: 9,
      completedCount: 1,
      totalStamps: 19,
      campaignStatus: CampaignStatus.ACTIVE,
      stampsRequired: 10,
    };
    const { prisma, createdStamps } = makeFakePrisma(state);
    const redemptions = makeFakeRedemptions();
    const service = new StampsService(
      prisma as unknown as PrismaService,
      makeFakeRedis() as unknown as RedisService,
      redemptions as unknown as RedemptionsService,
      makeFakeAudit() as unknown as AuditService,
      makeFakeWallet() as unknown as WalletService,
    );

    const result = await service.addStamp({
      businessId: BUSINESS_ID,
      membershipId: MEMBERSHIP_ID,
      issuerType: StampIssuerType.MERCHANT,
    });

    expect(result.rewardEarned).toBe(true);
    expect(result.reward).toBe('Free coffee');
    expect(state.stampCount).toBe(0);
    expect(state.completedCount).toBe(2);
    expect(createdStamps[0].completedCard).toBe(true);
    expect(result.stamp.issuerName).toBe('Owner');
    // Completing the card mints the voucher inside the transaction.
    expect(redemptions.createForCompletion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rewardText: 'Free coffee', membershipId: MEMBERSHIP_ID }),
    );
    expect(result.redemption?.code).toBe('RX7K9QZ2');
    expect(result.redemption?.formattedCode).toBe('RX7K-9QZ2');
  });

  it('blocks double-taps via the redis guard', async () => {
    const state: FakeState = {
      stampCount: 1,
      completedCount: 0,
      totalStamps: 1,
      campaignStatus: CampaignStatus.ACTIVE,
      stampsRequired: 10,
    };
    const { prisma } = makeFakePrisma(state);
    const service = new StampsService(
      prisma as unknown as PrismaService,
      makeFakeRedis(false) as unknown as RedisService,
      makeFakeRedemptions() as unknown as RedemptionsService,
      makeFakeAudit() as unknown as AuditService,
      makeFakeWallet() as unknown as WalletService,
    );

    await expect(
      service.addStamp({
        businessId: BUSINESS_ID,
        membershipId: MEMBERSHIP_ID,
        issuerType: StampIssuerType.STAFF,
        staffId: 'staff_1',
      }),
    ).rejects.toThrow(/wait a moment/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(state.stampCount).toBe(1);
  });

  it('refuses stamps on a paused campaign and releases the guard', async () => {
    const state: FakeState = {
      stampCount: 2,
      completedCount: 0,
      totalStamps: 2,
      campaignStatus: CampaignStatus.PAUSED,
      stampsRequired: 10,
    };
    const { prisma } = makeFakePrisma(state);
    const redis = makeFakeRedis();
    const service = new StampsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      makeFakeRedemptions() as unknown as RedemptionsService,
      makeFakeAudit() as unknown as AuditService,
      makeFakeWallet() as unknown as WalletService,
    );

    await expect(
      service.addStamp({
        businessId: BUSINESS_ID,
        membershipId: MEMBERSHIP_ID,
        issuerType: StampIssuerType.STAFF,
        staffId: 'staff_1',
      }),
    ).rejects.toThrow(/paused/i);
    expect(redis.delete).toHaveBeenCalled();
    expect(state.stampCount).toBe(2);
  });

  it('rejects memberships that belong to another business (tenant isolation)', async () => {
    const state: FakeState = {
      stampCount: 2,
      completedCount: 0,
      totalStamps: 2,
      campaignStatus: CampaignStatus.ACTIVE,
      stampsRequired: 10,
    };
    const { prisma } = makeFakePrisma(state);
    const service = new StampsService(
      prisma as unknown as PrismaService,
      makeFakeRedis() as unknown as RedisService,
      makeFakeRedemptions() as unknown as RedemptionsService,
      makeFakeAudit() as unknown as AuditService,
      makeFakeWallet() as unknown as WalletService,
    );

    await expect(
      service.addStamp({
        businessId: 'someone-elses-business',
        membershipId: MEMBERSHIP_ID,
        issuerType: StampIssuerType.STAFF,
        staffId: 'staff_1',
      }),
    ).rejects.toThrow(/not found/i);
    expect(state.stampCount).toBe(2);
  });
});
