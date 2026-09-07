import { Injectable } from '@nestjs/common';
import { AdminRole, AuditActorType, PlatformAdmin } from '@prisma/client';
import { hash, verify } from '@node-rs/argon2';
import { authenticator } from 'otplib';
import { createHash, randomBytes } from 'crypto';
import { badRequest, forbidden, unauthorized, tooManyRequests } from '../common/exceptions';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { QrService } from '../qr/qr.service';
import { AdminTokenService } from './admin-token.service';
import { capabilitiesForRole } from './admin.types';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SEC = 900;
const RECOVERY_CODE_COUNT = 8;

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: AdminTokenService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly qr: QrService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Step 1 — password. Never reveals whether the email exists: a wrong email
   * and a wrong password produce the same message and the same timing cost.
   */
  async login(email: string, password: string, meta: RequestMeta) {
    const normalisedEmail = email.trim().toLowerCase();
    const attemptKey = `adminlogin:${normalisedEmail}`;
    const attempts = await this.redis.incrementWithWindow(attemptKey, LOCKOUT_WINDOW_SEC);
    if (attempts > MAX_LOGIN_ATTEMPTS) {
      const retryAfter = Math.max(1, await this.redis.ttl(attemptKey));
      await this.audit.record({
        actorType: AuditActorType.SYSTEM,
        actorLabel: normalisedEmail,
        action: 'admin.login.locked_out',
        reason: `${attempts} failed attempts`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw tooManyRequests(
        'ADMIN_LOCKED_OUT',
        'Too many failed attempts. Try again later.',
        retryAfter,
      );
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: normalisedEmail },
    });

    // Always spend the verify cost so a missing account can't be detected by timing.
    const passwordOk = admin
      ? await verify(admin.passwordHash, password).catch(() => false)
      : await verify(DUMMY_HASH, password).catch(() => false);

    if (!admin || !passwordOk) {
      await this.audit.record({
        actorType: AuditActorType.SYSTEM,
        actorLabel: normalisedEmail,
        action: 'admin.login.failed',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    if (!admin.isActive) {
      throw forbidden('ADMIN_DEACTIVATED', 'This account has been deactivated.');
    }

    await this.redis.delete(attemptKey);

    // Password-only mode (development convenience). The env schema blocks
    // this in production, so the branch can never be reached there.
    if (!this.config.adminRequireTwoFactor) {
      return this.completeLogin(admin, meta, false, 'Two-factor disabled by configuration');
    }

    const twoFactorToken = await this.tokens.issueTwoFactorToken(admin.id, admin.role);
    return {
      status: admin.totpEnabledAt ? ('TWO_FACTOR_REQUIRED' as const) : ('TWO_FACTOR_SETUP_REQUIRED' as const),
      twoFactorToken,
      ...(admin.totpEnabledAt ? {} : await this.buildEnrollmentPayload(admin)),
    };
  }

  /** Step 2a — first-time enrolment: confirm the authenticator is working. */
  async enrollTwoFactor(twoFactorToken: string, code: string, meta: RequestMeta) {
    const payload = await this.tokens.verifyTwoFactorToken(twoFactorToken);
    const admin = await this.requireAdmin(payload.sub);
    if (admin.totpEnabledAt) {
      throw badRequest('TWO_FACTOR_ALREADY_SET', 'Two-factor is already configured.');
    }
    if (!admin.totpSecret) {
      throw badRequest('TWO_FACTOR_NOT_STARTED', 'Start the sign-in flow again.');
    }
    if (!authenticator.check(code, admin.totpSecret)) {
      throw badRequest('TWO_FACTOR_INVALID', "That code isn't right. Check your authenticator app.");
    }

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    );
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        totpEnabledAt: new Date(),
        recoveryCodes: recoveryCodes.map((c) => sha256(c)),
      },
    });
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: 'admin.2fa.enrolled',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const session = await this.completeLogin(admin, meta);
    // Recovery codes are shown exactly once, here.
    return { ...session, recoveryCodes };
  }

  /** Step 2b — normal sign-in: authenticator code or a recovery code. */
  async verifyTwoFactor(twoFactorToken: string, code: string, meta: RequestMeta) {
    const payload = await this.tokens.verifyTwoFactorToken(twoFactorToken);
    const admin = await this.requireAdmin(payload.sub);
    if (!admin.totpEnabledAt || !admin.totpSecret) {
      throw badRequest('TWO_FACTOR_NOT_SET', 'Two-factor is not configured for this account.');
    }

    const trimmed = code.trim().toUpperCase();
    const totpOk = authenticator.check(trimmed, admin.totpSecret);
    let usedRecoveryCode = false;

    if (!totpOk) {
      const hashed = sha256(trimmed);
      if (admin.recoveryCodes.includes(hashed)) {
        usedRecoveryCode = true;
        await this.prisma.platformAdmin.update({
          where: { id: admin.id },
          // Recovery codes are single-use.
          data: { recoveryCodes: admin.recoveryCodes.filter((c) => c !== hashed) },
        });
      } else {
        throw badRequest('TWO_FACTOR_INVALID', "That code isn't right. Try again.");
      }
    }

    const session = await this.completeLogin(admin, meta, usedRecoveryCode);
    return session;
  }

  async refresh(refreshToken: string) {
    const { adminId, tokens } = await this.tokens.refresh(refreshToken);
    const admin = await this.requireAdmin(adminId);
    return { tokens, admin: this.toDto(admin) };
  }

  async logout(refreshToken: string, admin: PlatformAdmin | null, meta: RequestMeta) {
    await this.tokens.revoke(refreshToken);
    if (admin) {
      await this.audit.record({
        actorType: AuditActorType.ADMIN,
        adminId: admin.id,
        actorLabel: admin.email,
        action: 'admin.logout',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }
  }

  toDto(admin: PlatformAdmin) {
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      capabilities: capabilitiesForRole(admin.role),
      twoFactorEnabled: admin.totpEnabledAt !== null,
      recoveryCodesRemaining: admin.recoveryCodes.length,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
    };
  }

  /** Hashing helper shared with team management. */
  static hashPassword(password: string): Promise<string> {
    return hash(password);
  }

  private async completeLogin(
    admin: PlatformAdmin,
    meta: RequestMeta,
    usedRecoveryCode = false,
    note?: string,
  ) {
    const [tokens] = await Promise.all([
      this.tokens.issueSession(admin.id, admin.role),
      this.prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: 'admin.login',
      reason: usedRecoveryCode ? 'Signed in with a recovery code' : (note ?? null),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { status: 'AUTHENTICATED' as const, tokens, admin: this.toDto(admin) };
  }

  /** Generates (or reuses) a TOTP secret and renders the enrolment QR. */
  private async buildEnrollmentPayload(admin: PlatformAdmin) {
    let secret = admin.totpSecret;
    if (!secret) {
      secret = authenticator.generateSecret();
      await this.prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { totpSecret: secret },
      });
    }
    const otpauthUrl = authenticator.keyuri(admin.email, 'Stamposa Admin', secret);
    return {
      twoFactorSetup: {
        secret,
        otpauthUrl,
        qrDataUrl: await this.qr.toDataUrl(otpauthUrl, 320),
      },
    };
  }

  private async requireAdmin(id: string): Promise<PlatformAdmin> {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id } });
    if (!admin) throw unauthorized('ACCOUNT_NOT_FOUND', 'Account no longer exists.');
    if (!admin.isActive) {
      throw forbidden('ADMIN_DEACTIVATED', 'This account has been deactivated.');
    }
    return admin;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * A real argon2 hash of a random value. Verified against when the email
 * doesn't exist so that response timing doesn't leak account existence.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$JDMtHZ8kM0OYAFm0hOZkMxTGVdKDXjmiCUOqfmRCPRs';

export { AdminRole };
