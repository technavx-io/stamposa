import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { badRequest, serviceUnavailable, tooManyRequests } from '../common/exceptions';
import { AppConfigService } from '../config/app-config.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email.types';
import { RedisService } from '../redis/redis.service';

const CODE_TTL_SEC = 900; // 15 min — email is slower to reach than SMS
const RESEND_COOLDOWN_SEC = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

interface StoredCode {
  hash: string;
  attempts: number;
}

export interface EmailCodeRequestResult {
  expiresInSec: number;
  resendInSec: number;
  /** Present only when OTP_DEV_EXPOSE is on outside production. */
  devCode?: string;
}

/**
 * Six-digit email confirmation codes for merchant signup — the email twin of
 * OtpService. Codes live only in Redis (peppered hash + attempt counter):
 *   emailverify:code:{email} · emailverify:cd:{email} · emailverify:hr:{email}
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async requestCode(email: string): Promise<EmailCodeRequestResult> {
    const cooldownKey = this.key('cd', email);
    const gotCooldown = await this.redis.setIfAbsent(cooldownKey, '1', RESEND_COOLDOWN_SEC);
    if (!gotCooldown) {
      const retryAfter = Math.max(1, await this.redis.ttl(cooldownKey));
      throw tooManyRequests(
        'EMAIL_CODE_COOLDOWN',
        `Please wait ${retryAfter}s before requesting another code.`,
        retryAfter,
      );
    }

    const hourlyKey = this.key('hr', email);
    const sends = await this.redis.incrementWithWindow(hourlyKey, 3600);
    if (sends > MAX_SENDS_PER_HOUR) {
      const retryAfter = Math.max(1, await this.redis.ttl(hourlyKey));
      throw tooManyRequests(
        'EMAIL_CODE_RATE_LIMITED',
        'Too many codes requested for this email. Try again later.',
        retryAfter,
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const stored: StoredCode = { hash: this.hash(email, code), attempts: 0 };
    await this.redis.setWithTtl(this.key('code', email), JSON.stringify(stored), CODE_TTL_SEC);

    try {
      await this.email.sendEmail({
        to: email,
        subject: `${code} is your Stamposa verification code`,
        text: `Welcome to Stamposa!\n\nYour verification code is ${code}. It expires in 15 minutes.\n\nIf you didn't create a Stamposa account, you can ignore this email.`,
      });
    } catch {
      // A failed send must not lock the person out: clear the code and the
      // resend cooldown so tapping "resend" works immediately.
      await this.redis.delete(this.key('code', email), cooldownKey);
      throw serviceUnavailable(
        'EMAIL_SEND_FAILED',
        'We could not send the verification email right now — please try again.',
      );
    }

    return {
      expiresInSec: CODE_TTL_SEC,
      resendInSec: RESEND_COOLDOWN_SEC,
      ...(this.config.otpDevExpose ? { devCode: code } : {}),
    };
  }

  /** Throws on failure; consumes the code on success. */
  async verifyCode(email: string, code: string): Promise<void> {
    const codeKey = this.key('code', email);
    const raw = await this.redis.get(codeKey);
    if (!raw) {
      throw badRequest('EMAIL_CODE_EXPIRED', 'That code has expired. Request a new one.');
    }

    const stored = JSON.parse(raw) as StoredCode;
    if (stored.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.redis.delete(codeKey);
      throw badRequest('EMAIL_CODE_TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Request a new code.');
    }

    if (!this.matches(stored.hash, email, code)) {
      stored.attempts += 1;
      await this.redis.setKeepTtl(codeKey, JSON.stringify(stored));
      const remaining = MAX_VERIFY_ATTEMPTS - stored.attempts;
      throw badRequest(
        'EMAIL_CODE_INVALID',
        remaining > 0
          ? `That code isn't right. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : 'Too many wrong attempts. Request a new code.',
      );
    }

    await this.redis.delete(codeKey);
  }

  private hash(email: string, code: string): string {
    return createHash('sha256')
      .update(`${email}:${code}:${this.config.jwtRefreshSecret}`)
      .digest('hex');
  }

  private matches(storedHash: string, email: string, code: string): boolean {
    const candidate = Buffer.from(this.hash(email, code), 'hex');
    const expected = Buffer.from(storedHash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }

  private key(kind: 'code' | 'cd' | 'hr', email: string): string {
    return `emailverify:${kind}:${email.toLowerCase()}`;
  }
}
