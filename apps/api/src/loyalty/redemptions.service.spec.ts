import { RedemptionStatus, StampIssuerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { RedemptionsService } from './redemptions.service';

const BUSINESS_ID = 'biz_1';

interface VoucherState {
  status: RedemptionStatus;
  redeemedAt: Date | null;
  redeemedByType: StampIssuerType | null;
  redeemedStaffId: string | null;
}

/** One stored voucher + the membership it belongs to. */
function makeFakePrisma(state: VoucherState) {
  const voucher = () => ({
    id: 'red_1',
    code: 'RX7K9QZ2',
    membershipId: 'mem_1',
    businessId: BUSINESS_ID,
    rewardText: 'Free coffee',
    earnedByStampId: 'stamp_1',
    status: state.status,
    redeemedAt: state.redeemedAt,
    redeemedByType: state.redeemedByType,
    redeemedStaffId: state.redeemedStaffId,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date(),
    redeemedStaff: state.redeemedStaffId
      ? { id: state.redeemedStaffId, name: 'Ravi Kumar' }
      : null,
    membership: {
      id: 'mem_1',
      code: 'AAAA2222',
      customerId: 'cust_1',
      businessId: BUSINESS_ID,
      campaignId: 'camp_1',
      stampCount: 2,
      completedCount: 1,
      totalStamps: 12,
      lastStampAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { id: 'cust_1', name: 'Aarav Shah', phone: '+919876501101' },
    },
  });

  const prisma = {
    redemption: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.businessId !== BUSINESS_ID) return null;
        if (where.id && where.id !== 'red_1') return null;
        if (where.code && where.code !== 'RX7K9QZ2') return null;
        return voucher();
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.id === 'red_1' && state.status === where.status) {
          state.status = data.status;
          state.redeemedAt = data.redeemedAt;
          state.redeemedByType = data.redeemedByType;
          state.redeemedStaffId = data.redeemedStaffId;
          return { count: 1 };
        }
        return { count: 0 };
      }),
      findUniqueOrThrow: jest.fn(async () => voucher()),
    },
    customerMembership: {
      findUniqueOrThrow: jest.fn(async () => ({
        ...voucher().membership,
        campaign: {
          id: 'camp_1',
          name: 'Card',
          description: null,
          stampsRequired: 10,
          reward: 'Free coffee',
          status: 'ACTIVE',
        },
        redemptions: [],
      })),
    },
  };

  return { prisma, state };
}

function makeService(state: VoucherState) {
  const { prisma } = makeFakePrisma(state);
  return { service: new RedemptionsService(prisma as unknown as PrismaService, { cardChanged: jest.fn(async () => undefined) } as unknown as WalletService), prisma };
}

const pendingState = (): VoucherState => ({
  status: RedemptionStatus.PENDING,
  redeemedAt: null,
  redeemedByType: null,
  redeemedStaffId: null,
});

describe('RedemptionsService.redeem', () => {
  it('redeems a pending voucher by id and records who honoured it', async () => {
    const state = pendingState();
    const { service } = makeService(state);

    const result = await service.redeem({
      businessId: BUSINESS_ID,
      redemptionId: 'red_1',
      redeemerType: StampIssuerType.STAFF,
      staffId: 'staff_1',
    });

    expect(state.status).toBe(RedemptionStatus.REDEEMED);
    expect(state.redeemedStaffId).toBe('staff_1');
    expect(result.redemption.status).toBe(RedemptionStatus.REDEEMED);
    expect(result.redemption.redeemedBy).toBe('Ravi Kumar');
    expect(result.card.id).toBe('mem_1');
  });

  it('redeems by voucher code with normalisation', async () => {
    const state = pendingState();
    const { service, prisma } = makeService(state);

    await service.redeem({
      businessId: BUSINESS_ID,
      code: ' rx7k-9qz2 ',
      redeemerType: StampIssuerType.MERCHANT,
    });

    expect(prisma.redemption.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ code: 'RX7K9QZ2' }) }),
    );
    expect(state.status).toBe(RedemptionStatus.REDEEMED);
    expect(state.redeemedByType).toBe(StampIssuerType.MERCHANT);
  });

  it('rejects double redemption', async () => {
    const state: VoucherState = {
      status: RedemptionStatus.REDEEMED,
      redeemedAt: new Date('2026-08-02T09:00:00Z'),
      redeemedByType: StampIssuerType.STAFF,
      redeemedStaffId: 'staff_1',
    };
    const { service } = makeService(state);

    await expect(
      service.redeem({
        businessId: BUSINESS_ID,
        redemptionId: 'red_1',
        redeemerType: StampIssuerType.STAFF,
        staffId: 'staff_2',
      }),
    ).rejects.toThrow(/already redeemed/i);
  });

  it('hides vouchers from other tenants (404)', async () => {
    const { service } = makeService(pendingState());

    await expect(
      service.redeem({
        businessId: 'someone-elses-business',
        redemptionId: 'red_1',
        redeemerType: StampIssuerType.STAFF,
        staffId: 'staff_1',
      }),
    ).rejects.toThrow(/no reward voucher/i);
  });

  it('requires an id or a code', async () => {
    const { service } = makeService(pendingState());

    await expect(
      service.redeem({
        businessId: BUSINESS_ID,
        redeemerType: StampIssuerType.STAFF,
        staffId: 'staff_1',
      }),
    ).rejects.toThrow(/redemptionId or a voucher code/i);
  });
});
