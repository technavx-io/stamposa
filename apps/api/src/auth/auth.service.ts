import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../common/exceptions';
import { PasswordService } from '../common/password.service';
import { PhoneService } from '../common/phone.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { toBusinessDto } from '../businesses/dto/business.dto';
import { ActorRole, AuthActor } from './auth.types';
import {
  AuthResultDto,
  AuthSessionDto,
  EmailVerificationRequestedDto,
  MeDto,
  OtpRequestedDto,
  TokensDto,
} from './dto/auth-response.dto';
import { EmailVerificationService } from './email-verification.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { Identifier, IdentifierService } from '../common/identifier.service';

interface ActorRecord {
  id: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly phones: PhoneService,
    private readonly identifiers: IdentifierService,
    private readonly passwords: PasswordService,
    private readonly config: AppConfigService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  // ── Merchant + staff: email + password ────────────────────────────────

  /**
   * Self-serve merchant signup. The account is created UNVERIFIED and a
   * 6-digit code is emailed; sign-in stays blocked until it's confirmed.
   * Re-signing up on an unverified email refreshes the credentials and
   * resends, so an abandoned attempt is never a dead end.
   */
  async signupMerchant(
    email: string,
    password: string,
    name: string,
  ): Promise<EmailVerificationRequestedDto> {
    const passwordHash = await this.passwords.hash(password);
    const existing = await this.prisma.merchant.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) {
      throw conflict(
        'EMAIL_TAKEN',
        'An account with this email already exists. Try signing in instead.',
      );
    }
    if (existing) {
      await this.prisma.merchant.update({ where: { email }, data: { passwordHash, name } });
    } else {
      await this.prisma.merchant.create({ data: { email, passwordHash, name } });
    }
    const result = await this.emailVerification.requestCode(email);
    return { verificationRequired: true, email, ...result };
  }

  /** Confirm the signup code, mark the email verified, and sign the merchant in. */
  async verifyMerchantEmail(email: string, code: string): Promise<AuthSessionDto> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { email },
      include: { business: true },
    });
    if (!merchant) {
      throw notFound('MERCHANT_NOT_FOUND', 'No signup found for this email. Create an account first.');
    }
    if (!merchant.emailVerifiedAt) {
      await this.emailVerification.verifyCode(email, code);
      await this.prisma.merchant.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
    }
    return this.buildSession(
      'MERCHANT',
      merchant,
      merchant.business && toBusinessDto(merchant.business, this.urls()),
    );
  }

  /** Resend the signup code — only for accounts that still need verifying. */
  async resendMerchantVerification(email: string): Promise<OtpRequestedDto> {
    const merchant = await this.prisma.merchant.findUnique({ where: { email } });
    // Don't reveal whether the email exists or is already verified.
    if (!merchant || merchant.emailVerifiedAt) {
      return { expiresInSec: 900, resendInSec: 60 };
    }
    return this.emailVerification.requestCode(email);
  }

  async loginMerchant(email: string, password: string): Promise<AuthSessionDto> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { email },
      include: { business: true },
    });
    // Verify unconditionally (dummy hash when no account) for constant timing.
    const ok = await this.passwords.verify(merchant?.passwordHash, password);
    if (!merchant || !ok) {
      throw unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    if (!merchant.emailVerifiedAt) {
      throw forbidden(
        'EMAIL_NOT_VERIFIED',
        'Please verify your email to finish setting up your account.',
      );
    }
    if (merchant.business?.suspendedAt) {
      throw forbidden(
        'BUSINESS_SUSPENDED',
        merchant.business.suspendedReason
          ? `This account is suspended: ${merchant.business.suspendedReason}`
          : 'This account has been suspended. Contact support.',
      );
    }
    return this.buildSession(
      'MERCHANT',
      merchant,
      merchant.business && toBusinessDto(merchant.business, this.urls()),
    );
  }

  /** Staff have no self-signup — the merchant creates them with a password. */
  async loginStaff(email: string, password: string): Promise<AuthSessionDto> {
    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { business: true },
    });
    const ok = await this.passwords.verify(staff?.passwordHash, password);
    if (!staff || !ok) {
      throw unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    if (!staff.isActive) {
      throw forbidden('STAFF_INACTIVE', 'This staff account has been deactivated.');
    }
    if (staff.business.suspendedAt) {
      throw forbidden(
        'BUSINESS_SUSPENDED',
        'This business account is suspended. Ask the owner to contact support.',
      );
    }
    return this.buildSession('STAFF', staff, toBusinessDto(staff.business, this.urls()));
  }

  // ── Customer: phone + OTP (unchanged) ─────────────────────────────────

  async requestOtp(role: ActorRole, rawIdentifier: string): Promise<OtpRequestedDto> {
    const identifier = this.resolveIdentifier(role, rawIdentifier);
    const phone = identifier.value;

    if (role === 'STAFF') {
      // Staff accounts are created by merchants — fail before sending SMS.
      const staff = await this.prisma.staff.findUnique({
        where: { phone },
        include: { business: true },
      });
      if (!staff) {
        throw notFound(
          'STAFF_NOT_FOUND',
          'No staff account for this number. Ask your manager to add you.',
        );
      }
      if (!staff.isActive) {
        throw forbidden('STAFF_INACTIVE', 'This staff account has been deactivated.');
      }
      if (staff.business.suspendedAt) {
        throw forbidden(
          'BUSINESS_SUSPENDED',
          'This business account is suspended. Ask the owner to contact support.',
        );
      }
    }

    if (role === 'MERCHANT') {
      const merchant = await this.prisma.merchant.findUnique({
        where: { phone },
        include: { business: true },
      });
      if (merchant?.business?.suspendedAt) {
        throw forbidden(
          'BUSINESS_SUSPENDED',
          merchant.business.suspendedReason
            ? `This account is suspended: ${merchant.business.suspendedReason}`
            : 'This account has been suspended. Contact support.',
        );
      }
    }

    return this.otp.requestCode(role, identifier);
  }

  async verifyOtp(role: ActorRole, rawIdentifier: string, code: string): Promise<AuthResultDto> {
    const identifier = this.resolveIdentifier(role, rawIdentifier);
    const phone = identifier.value;
    await this.otp.verifyCode(role, identifier, code);

    switch (role) {
      case 'MERCHANT': {
        const merchant = await this.prisma.merchant.findUnique({
          where: { phone },
          include: { business: true },
        });
        if (!merchant) return this.registrationRequired(role, phone);
        return this.authenticated(role, merchant, merchant.business);
      }
      case 'CUSTOMER': {
        // Look up by whichever identity they signed in with.
        const customer = await this.prisma.customer.findUnique({
          where: this.identifiers.whereClause(identifier),
        });
        if (!customer) return this.registrationRequired(role, identifier.value);
        return this.authenticated(role, customer, null);
      }
      case 'STAFF': {
        const staff = await this.prisma.staff.findUnique({
          where: { phone },
          include: { business: true },
        });
        if (!staff) {
          throw notFound('STAFF_NOT_FOUND', 'No staff account for this number.');
        }
        if (!staff.isActive) {
          throw forbidden('STAFF_INACTIVE', 'This staff account has been deactivated.');
        }
        return this.authenticated(role, staff, staff.business);
      }
    }
  }

  async registerMerchant(registrationToken: string, name: string): Promise<AuthSessionDto> {
    const phone = await this.tokens.verifyRegistrationToken(registrationToken, 'MERCHANT');
    try {
      const merchant = await this.prisma.merchant.create({ data: { phone, name } });
      return this.buildSession('MERCHANT', merchant, null);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Registered in a parallel request — treat as login.
        const merchant = await this.prisma.merchant.findUniqueOrThrow({
          where: { phone },
          include: { business: true },
        });
        return this.buildSession('MERCHANT', merchant, merchant.business && toBusinessDto(merchant.business, this.urls()));
      }
      throw e;
    }
  }

  async registerCustomer(registrationToken: string, name: string): Promise<AuthSessionDto> {
    // The token carries the verified identifier verbatim. It is self-describing
    // — an email contains "@" — so no token format change was needed to support
    // both kinds.
    const verified = await this.tokens.verifyRegistrationToken(registrationToken, 'CUSTOMER');
    const identifier = this.identifiers.normalize(verified);
    const identity =
      identifier.kind === 'PHONE' ? { phone: identifier.value } : { email: identifier.value };

    try {
      const customer = await this.prisma.customer.create({ data: { ...identity, name } });
      return this.buildSession('CUSTOMER', customer, null);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Registered in a parallel request — treat as login.
        const customer = await this.prisma.customer.findUniqueOrThrow({
          where: this.identifiers.whereClause(identifier),
        });
        return this.buildSession('CUSTOMER', customer, null);
      }
      throw e;
    }
  }

  async refresh(refreshToken: string): Promise<TokensDto> {
    const { tokens } = await this.tokens.refreshSession(refreshToken);
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeSession(refreshToken);
  }

  me(actor: AuthActor): MeDto {
    switch (actor.role) {
      case 'MERCHANT':
        return {
          role: actor.role,
          actor: this.actorSummary(actor.role, actor.merchant),
          business: actor.merchant.business
            ? toBusinessDto(actor.merchant.business, this.urls())
            : null,
          impersonation: actor.impersonation ?? null,
        };
      case 'STAFF':
        return {
          role: actor.role,
          actor: this.actorSummary(actor.role, actor.staff),
          business: toBusinessDto(actor.staff.business, this.urls()),
        };
      case 'CUSTOMER':
        return {
          role: actor.role,
          actor: this.actorSummary(actor.role, actor.customer),
          business: null,
        };
    }
  }

  /**
   * Customers may identify with a phone number OR an email address. Staff and
   * merchants stay phone-only on this path: both already have email+password
   * sign-in, and their accounts are created by someone else (a merchant adds
   * staff; a merchant signs up with a verified email), so an email-OTP route
   * for them would be a second, weaker way into the same account.
   */
  private resolveIdentifier(role: ActorRole, raw: string): Identifier {
    const identifier = this.identifiers.normalize(raw);
    if (role !== 'CUSTOMER' && identifier.kind === 'EMAIL') {
      throw badRequest(
        'PHONE_REQUIRED',
        'Enter your phone number, or sign in with your email and password instead.',
      );
    }
    return identifier;
  }

  private async registrationRequired(role: ActorRole, phone: string): Promise<AuthResultDto> {
    const registrationToken = await this.tokens.issueRegistrationToken(role, phone);
    return { status: 'REGISTRATION_REQUIRED', session: null, registrationToken };
  }

  private async authenticated(
    role: ActorRole,
    record: ActorRecord,
    business: Prisma.BusinessGetPayload<object> | null,
  ): Promise<AuthResultDto> {
    const session = await this.buildSession(
      role,
      record,
      business && toBusinessDto(business, this.urls()),
    );
    return { status: 'AUTHENTICATED', session, registrationToken: null };
  }

  private async buildSession(
    role: ActorRole,
    record: ActorRecord,
    business: AuthSessionDto['business'] | null,
  ): Promise<AuthSessionDto> {
    const tokens = await this.tokens.issueSession(role, record.id);
    return {
      tokens,
      actor: this.actorSummary(role, record),
      business: business ?? null,
    };
  }

  private actorSummary(role: ActorRole, record: ActorRecord) {
    return {
      id: record.id,
      role,
      name: record.name ?? null,
      email: record.email ?? null,
      phone: record.phone ?? null,
    };
  }

  private urls() {
    return { apiPublicUrl: this.config.apiPublicUrl, webAppUrl: this.config.webAppUrl };
  }
}
