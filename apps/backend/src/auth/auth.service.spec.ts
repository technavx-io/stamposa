import { DomainException } from '../common/exceptions';
import { PasswordService } from '../common/password.service';
import { PhoneService } from '../common/phone.service';
import { IdentifierService } from '../common/identifier.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { OtpService } from './otp.service';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';

interface FakeMerchant {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  business: FakeBusiness | null;
}

interface FakeStaff {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  passwordHash: string;
  isActive: boolean;
  business: FakeBusiness;
}

interface FakeBusiness {
  id: string;
  name: string;
  slug: string;
  logoPath: string | null;
  address: string | null;
  phone: string | null;
  googleReviewUrl: string | null;
  brandColor: string;
  stampIcon: string;
  rewardIcon: string;
  cardImagePath: string | null;
  cardImageTint: string | null;
  category: string | null;
  timezone: string;
  consentText: string | null;
  notifyDailySummary: boolean;
  notifyWeeklyDigest: boolean;
  notifyStaffInactive: boolean;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  createdAt: Date;
}

function makeBusiness(overrides: Partial<FakeBusiness> = {}): FakeBusiness {
  return {
    id: 'biz_1',
    name: 'Cafe One',
    slug: 'cafe-one',
    logoPath: null,
    address: null,
    phone: null,
    googleReviewUrl: null,
    brandColor: '#000',
    stampIcon: 'coffee',
    rewardIcon: 'gift',
    cardImagePath: null,
    cardImageTint: null,
    category: null,
    timezone: 'Asia/Kolkata',
    consentText: null,
    notifyDailySummary: true,
    notifyWeeklyDigest: true,
    notifyStaffInactive: true,
    suspendedAt: null,
    suspendedReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeMerchant(overrides: Partial<FakeMerchant> = {}): FakeMerchant {
  return {
    id: 'mer_1',
    email: 'owner@example.com',
    name: 'Owner Name',
    phone: null,
    passwordHash: 'stored-hash',
    emailVerifiedAt: null,
    business: null,
    ...overrides,
  };
}

function makeStaff(overrides: Partial<FakeStaff> = {}): FakeStaff {
  return {
    id: 'stf_1',
    email: 'staff@example.com',
    name: 'Staff One',
    phone: null,
    passwordHash: 'stored-hash',
    isActive: true,
    business: makeBusiness(),
    ...overrides,
  };
}

function makeService(opts: {
  merchant?: FakeMerchant | null;
  staff?: FakeStaff | null;
  passwordValid?: boolean;
} = {}) {
  const prisma = {
    merchant: {
      findUnique: jest.fn(async () => opts.merchant ?? null),
      update: jest.fn(async ({ data }: any) => ({
        ...(opts.merchant as FakeMerchant),
        ...data,
      })),
    },
    staff: {
      findUnique: jest.fn(async () => opts.staff ?? null),
    },
  };

  const emailVerification = {
    requestCode: jest.fn(async () => ({ expiresInSec: 900, resendInSec: 60 })),
    verifyCode: jest.fn(async () => undefined),
  };

  const passwords = {
    hash: jest.fn(async (p: string) => `hash(${p})`),
    verify: jest.fn(async () => opts.passwordValid ?? true),
  };

  const tokens = {
    issueSession: jest.fn(async (_role: string, actorId: string) => ({
      accessToken: `access-${actorId}`,
      refreshToken: `refresh-${actorId}`,
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 60 * 60 * 24 * 30,
    })),
  };

  const config = {
    apiPublicUrl: 'https://api.example.test',
    webAppUrl: 'https://app.example.test',
  };

  // Unused by the code paths under test — stubbed to satisfy the constructor.
  const otp = {} as OtpService;
  const phones = {} as PhoneService;
  const identifiers = {} as IdentifierService;
  const passwordReset = {} as PasswordResetService;

  const service = new AuthService(
    prisma as unknown as PrismaService,
    otp,
    tokens as unknown as TokenService,
    phones,
    identifiers,
    passwords as unknown as PasswordService,
    config as unknown as AppConfigService,
    emailVerification as unknown as EmailVerificationService,
    passwordReset,
  );

  return { service, prisma, emailVerification, passwords, tokens };
}

async function expectDomainException(
  promise: Promise<unknown>,
): Promise<DomainException> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainException);
    return e as DomainException;
  }
  throw new Error('Expected promise to reject with DomainException, but it resolved.');
}

describe('AuthService', () => {
  describe('verifyMerchantEmail', () => {
    it('verifies a fresh signup, sets emailVerifiedAt, and returns a session', async () => {
      const merchant = makeMerchant({ emailVerifiedAt: null });
      const { service, prisma, emailVerification, tokens } = makeService({ merchant });

      const session = await service.verifyMerchantEmail(merchant.email, '123456');

      expect(emailVerification.verifyCode).toHaveBeenCalledWith(merchant.email, '123456');
      expect(prisma.merchant.update).toHaveBeenCalledWith({
        where: { email: merchant.email },
        data: { emailVerifiedAt: expect.any(Date) },
      });
      expect(tokens.issueSession).toHaveBeenCalledWith('MERCHANT', merchant.id);
      expect(session.tokens.accessToken).toBe(`access-${merchant.id}`);
      expect(session.actor.id).toBe(merchant.id);
      expect(session.actor.role).toBe('MERCHANT');
      expect(session.business).toBeNull();
    });

    it('REGRESSION bug #17: refuses when emailVerifiedAt is already set — never checks the code, never returns a session', async () => {
      const merchant = makeMerchant({
        emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      });
      const { service, prisma, emailVerification, tokens } = makeService({ merchant });

      const err = await expectDomainException(
        service.verifyMerchantEmail(merchant.email, 'anything'),
      );

      expect(err.getStatus()).toBe(403);
      expect(err.getResponse()).toMatchObject({ code: 'EMAIL_ALREADY_VERIFIED' });

      // The exact invariants that would have caught the original bug:
      expect(emailVerification.verifyCode).not.toHaveBeenCalled();
      expect(prisma.merchant.update).not.toHaveBeenCalled();
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });

    it('throws MERCHANT_NOT_FOUND for an unknown email', async () => {
      const { service, emailVerification, tokens } = makeService({ merchant: null });

      const err = await expectDomainException(
        service.verifyMerchantEmail('nobody@example.com', '123456'),
      );
      expect(err.getStatus()).toBe(404);
      expect(err.getResponse()).toMatchObject({ code: 'MERCHANT_NOT_FOUND' });
      expect(emailVerification.verifyCode).not.toHaveBeenCalled();
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });
  });

  describe('loginMerchant', () => {
    it('rejects the wrong password with INVALID_CREDENTIALS', async () => {
      const merchant = makeMerchant({ emailVerifiedAt: new Date() });
      const { service, tokens } = makeService({ merchant, passwordValid: false });

      const err = await expectDomainException(
        service.loginMerchant(merchant.email, 'wrong'),
      );
      expect(err.getStatus()).toBe(401);
      expect(err.getResponse()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });

    it('rejects unknown accounts with INVALID_CREDENTIALS (does not leak existence)', async () => {
      const { service, passwords } = makeService({ merchant: null, passwordValid: false });

      const err = await expectDomainException(
        service.loginMerchant('nobody@example.com', 'whatever'),
      );
      expect(err.getResponse()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      // Constant-timing: verify is still called even without an account.
      expect(passwords.verify).toHaveBeenCalled();
    });

    it('refuses to log in an unverified merchant', async () => {
      const merchant = makeMerchant({ emailVerifiedAt: null });
      const { service, tokens } = makeService({ merchant, passwordValid: true });

      const err = await expectDomainException(
        service.loginMerchant(merchant.email, 'right'),
      );
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });

    it('refuses a suspended business', async () => {
      const merchant = makeMerchant({
        emailVerifiedAt: new Date(),
        business: makeBusiness({
          suspendedAt: new Date(),
          suspendedReason: 'chargebacks',
        }),
      });
      const { service, tokens } = makeService({ merchant, passwordValid: true });

      const err = await expectDomainException(
        service.loginMerchant(merchant.email, 'right'),
      );
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse()).toMatchObject({ code: 'BUSINESS_SUSPENDED' });
      expect((err.getResponse() as { message: string }).message).toContain('chargebacks');
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });

    it('returns a session for a verified merchant with a live business', async () => {
      const business = makeBusiness();
      const merchant = makeMerchant({ emailVerifiedAt: new Date(), business });
      const { service, tokens } = makeService({ merchant, passwordValid: true });

      const session = await service.loginMerchant(merchant.email, 'right');

      expect(tokens.issueSession).toHaveBeenCalledWith('MERCHANT', merchant.id);
      expect(session.actor.id).toBe(merchant.id);
      expect(session.business?.id).toBe(business.id);
      expect(session.business?.suspended).toBe(false);
    });
  });

  describe('loginStaff', () => {
    it('refuses inactive staff', async () => {
      const staff = makeStaff({ isActive: false });
      const { service, tokens } = makeService({ staff, passwordValid: true });

      const err = await expectDomainException(
        service.loginStaff(staff.email, 'right'),
      );
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse()).toMatchObject({ code: 'STAFF_INACTIVE' });
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });

    it('refuses staff whose business is suspended', async () => {
      const staff = makeStaff({
        isActive: true,
        business: makeBusiness({ suspendedAt: new Date() }),
      });
      const { service, tokens } = makeService({ staff, passwordValid: true });

      const err = await expectDomainException(
        service.loginStaff(staff.email, 'right'),
      );
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse()).toMatchObject({ code: 'BUSINESS_SUSPENDED' });
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });

    it('rejects the wrong password with INVALID_CREDENTIALS', async () => {
      const staff = makeStaff();
      const { service, tokens } = makeService({ staff, passwordValid: false });

      const err = await expectDomainException(
        service.loginStaff(staff.email, 'wrong'),
      );
      expect(err.getStatus()).toBe(401);
      expect(err.getResponse()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });

    it('returns a session for an active staff at a live business', async () => {
      const staff = makeStaff();
      const { service, tokens } = makeService({ staff, passwordValid: true });

      const session = await service.loginStaff(staff.email, 'right');

      expect(tokens.issueSession).toHaveBeenCalledWith('STAFF', staff.id);
      expect(session.actor.role).toBe('STAFF');
      expect(session.business?.id).toBe(staff.business.id);
    });
  });

  describe('resendMerchantVerification', () => {
    it('stays silent (no send) for an unknown email — must not leak existence', async () => {
      const { service, emailVerification } = makeService({ merchant: null });

      const result = await service.resendMerchantVerification('ghost@example.com');

      expect(result).toEqual({ expiresInSec: 900, resendInSec: 60 });
      expect(emailVerification.requestCode).not.toHaveBeenCalled();
    });

    it('stays silent (no send) for an already-verified email — must not leak state', async () => {
      const merchant = makeMerchant({ emailVerifiedAt: new Date() });
      const { service, emailVerification } = makeService({ merchant });

      const result = await service.resendMerchantVerification(merchant.email);

      expect(result).toEqual({ expiresInSec: 900, resendInSec: 60 });
      expect(emailVerification.requestCode).not.toHaveBeenCalled();
    });

    it('requests a fresh code for an unverified account', async () => {
      const merchant = makeMerchant({ emailVerifiedAt: null });
      const { service, emailVerification } = makeService({ merchant });

      await service.resendMerchantVerification(merchant.email);

      expect(emailVerification.requestCode).toHaveBeenCalledWith(merchant.email);
    });
  });
});
