import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { badRequest, serviceUnavailable, tooManyRequests } from '../common/exceptions';
import { AppConfigService } from '../config/app-config.service';
import { RedisService } from '../redis/redis.service';
import { SMS_PROVIDER, SmsProvider } from '../sms/sms.types';
import { ActorRole } from './auth.types';

const OTP_TTL_SEC = 300;
const RESEND_COOLDOWN_SEC = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

interface StoredOtp {
  hash: string;
  attempts: number;
}

export interface OtpRequestResult {
  expiresInSec: number;
  resendInSec: number;
  /** Present only when OTP_DEV_EXPOSE is on outside production. */
  devCode?: string;
}

/**
 * One-time codes live exclusively in Redis (never the database):
 *   otp:code:{role}:{phone}  — peppered hash + attempt counter, 5 min TTL
 *   otp:cd:{role}:{phone}    — resend cooldown, 60 s TTL
 *   otp:hr:{role}:{phone}    — sends-per-hour counter, 1 h TTL
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async requestCode(role: ActorRole, phoneE164: string): Promise<OtpRequestResult> {
    const cooldownKey = this.key('cd', role, phoneE164);
    const gotCooldown = await this.redis.setIfAbsent(cooldownKey, '1', RESEND_COOLDOWN_SEC);
    if (!gotCooldown) {
      const retryAfter = Math.max(1, await this.redis.ttl(cooldownKey));
      throw tooManyRequests(
        'OTP_COOLDOWN',
        `Please wait ${retryAfter}s before requesting another code.`,
        retryAfter,
      );
    }

    const hourlyKey = this.key('hr', role, phoneE164);
    const sends = await this.redis.incrementWithWindow(hourlyKey, 3600);
    if (sends > MAX_SENDS_PER_HOUR) {
      const retryAfter = Math.max(1, await this.redis.ttl(hourlyKey));
      throw tooManyRequests(
        'OTP_RATE_LIMITED',
        'Too many codes requested for this number. Try again later.',
        retryAfter,
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const stored: StoredOtp = { hash: this.hash(phoneE164, code), attempts: 0 };
    await this.redis.setWithTtl(this.key('code', role, phoneE164), JSON.stringify(stored), OTP_TTL_SEC);

    try {
      await this.sms.sendOtp(
        phoneE164,
        code,
        `${code} is your Stamposa verification code. It expires in 5 minutes.`,
      );
    } catch {
      // A failed send must not lock the person out: clear the code and the
      // resend cooldown so tapping "resend" works immediately.
      await this.redis.delete(this.key('code', role, phoneE164), cooldownKey);
      throw serviceUnavailable(
        'SMS_SEND_FAILED',
        'We could not send the code right now — please try again.',
      );
    }

    return {
      expiresInSec: OTP_TTL_SEC,
      resendInSec: RESEND_COOLDOWN_SEC,
      ...(this.config.otpDevExpose ? { devCode: code } : {}),
    };
  }

  /** Throws on failure; consumes the code on success. */
  async verifyCode(role: ActorRole, phoneE164: string, code: string): Promise<void> {
    const codeKey = this.key('code', role, phoneE164);
    const raw = await this.redis.get(codeKey);
    if (!raw) {
      throw badRequest('OTP_EXPIRED', 'That code has expired. Request a new one.');
    }

    const stored = JSON.parse(raw) as StoredOtp;
    if (stored.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.redis.delete(codeKey);
      throw badRequest('OTP_TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Request a new code.');
    }

    if (!this.matches(stored.hash, phoneE164, code)) {
      stored.attempts += 1;
      await this.redis.setKeepTtl(codeKey, JSON.stringify(stored));
      const remaining = MAX_VERIFY_ATTEMPTS - stored.attempts;
      throw badRequest(
        'OTP_INVALID',
        remaining > 0
          ? `That code isn't right. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : 'Too many wrong attempts. Request a new code.',
      );
    }

    await this.redis.delete(codeKey);
  }

  /**
   * Codes are stored peppered+hashed so a leaked Redis snapshot can't be
   * replayed offline against the 10^6 code space.
   */
  private hash(phoneE164: string, code: string): string {
    return createHash('sha256')
      .update(`${phoneE164}:${code}:${this.config.jwtRefreshSecret}`)
      .digest('hex');
  }

  private matches(storedHash: string, phoneE164: string, code: string): boolean {
    const candidate = Buffer.from(this.hash(phoneE164, code), 'hex');
    const expected = Buffer.from(storedHash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }

  private key(kind: 'code' | 'cd' | 'hr', role: ActorRole, phone: string): string {
    return `otp:${kind}:${role}:${phone}`;
  }
}
