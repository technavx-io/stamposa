import { StaffRole } from '@prisma/client';
import { TokenService } from '../auth/token.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { PasswordService } from '../common/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { StaffManagementService } from './staff-management.service';

/**
 * Regression tests for bug #N4: resetting a staff password must revoke every
 * existing refresh-token session for that staff, so a stolen counter-device
 * session can't survive the password rotation until natural expiry.
 */
describe('StaffManagementService.update — password reset', () => {
  function make(opts: { existingPasswordHash?: string } = {}) {
    const existing = {
      id: 'stf_1',
      businessId: 'biz_1',
      role: StaffRole.STAFF,
      isActive: true,
      passwordHash: opts.existingPasswordHash ?? 'old-hash',
    };
    const updated = { ...existing, _count: { stampsIssued: 0 } };

    const prisma = {
      staff: {
        findFirst: jest.fn(async () => existing),
        update: jest.fn(async () => updated),
        count: jest.fn(async () => 0),
      },
    };

    const passwords = {
      hash: jest.fn(async (p: string) => `hash(${p})`),
      verify: jest.fn(async () => true),
    };

    const entitlements = {
      forBusiness: jest.fn(async () => ({
        tier: 'STARTER',
        limits: { maxManagers: null },
      })),
    };

    const tokens = {
      revokeAllForActor: jest.fn(async () => 1),
    };

    const service = new StaffManagementService(
      prisma as unknown as PrismaService,
      passwords as unknown as PasswordService,
      entitlements as unknown as EntitlementsService,
      tokens as unknown as TokenService,
    );

    return { service, prisma, passwords, tokens };
  }

  it('revokes every staff session when the merchant resets the password (bug #N4)', async () => {
    const { service, prisma, tokens } = make();

    await service.update('biz_1', 'stf_1', { password: 'brand-new-pass' });

    expect(prisma.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stf_1' },
        data: expect.objectContaining({ passwordHash: 'hash(brand-new-pass)' }),
      }),
    );
    expect(tokens.revokeAllForActor).toHaveBeenCalledWith('STAFF', 'stf_1');
  });

  it('does NOT revoke sessions when the update leaves the password alone', async () => {
    const { service, tokens } = make();

    await service.update('biz_1', 'stf_1', { name: 'New Name' });

    expect(tokens.revokeAllForActor).not.toHaveBeenCalled();
  });
});
