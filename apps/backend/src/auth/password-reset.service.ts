import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { badRequest, serviceUnavailable, tooManyRequests } from '../common/exceptions';
import { AppConfigService } from '../config/app-config.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email.types';
import { RedisService } from '../redis/redis.service';
import { passwordResetLinkEmail } from '../email/email-templates';

const TOKEN_TTL_SEC = 1800; // 30 min — links must survive an email round-trip
const RESEND_COOLDOWN_SEC = 60;
const MAX_SENDS_PER_HOUR = 5;
const TOKEN_BYTES = 32; // 256 bits of entropy, base64url-encoded → ~43 chars

interface StoredToken {
  email: string;
}

export interface PasswordResetRequestResult {
  /** How long the emailed link stays valid. */
  expiresInSec: number;
  resendInSec: number;
}

/**
 * Magic-link password reset for merchants. Flow:
 *   1. requestReset(email) generates a 32-byte URL-safe token and emails a link
 *      https://app.stamposa.com/merchant/reset-password?token=<token>
 *   2. The plaintext token exists only in the email; Redis stores the SHA-256
 *      hash keyed under `pwreset:tok:{hash}` → { email }, TTL 30 min.
 *   3. verifyAndConsume(token) rehashes the token, looks it up, deletes it
 *      (single-use), and returns the associated email.
 *
 * The AUTH SERVICE gates on account existence — this service always sends when
 * asked, so callers control the "silent for unknown emails" behaviour and this
 * service never leaks whether a token was ever issued for a given address.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async requestReset(email: string): Promise<PasswordResetRequestResult> {
    const cooldownKey = this.throttleKey('cd', email);
    const gotCooldown = await this.redis.setIfAbsent(cooldownKey, '1', RESEND_COOLDOWN_SEC);
    if (!gotCooldown) {
      const retryAfter = Math.max(1, await this.redis.ttl(cooldownKey));
      throw tooManyRequests(
        'PASSWORD_RESET_COOLDOWN',
        `Please wait ${retryAfter}s before requesting another reset link.`,
        retryAfter,
      );
    }

    const hourlyKey = this.throttleKey('hr', email);
    const sends = await this.redis.incrementWithWindow(hourlyKey, 3600);
    if (sends > MAX_SENDS_PER_HOUR) {
      const retryAfter = Math.max(1, await this.redis.ttl(hourlyKey));
      throw tooManyRequests(
        'PASSWORD_RESET_RATE_LIMITED',
        'Too many reset links requested. Try again later.',
        retryAfter,
      );
    }

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const stored: StoredToken = { email: email.toLowerCase() };
    await this.redis.setWithTtl(this.tokenKey(token), JSON.stringify(stored), TOKEN_TTL_SEC);

    const resetUrl = `${this.config.webAppUrl}/merchant/reset-password?token=${token}`;

    try {
      const mail = passwordResetLinkEmail({
        resetUrl,
        expiresMin: Math.round(TOKEN_TTL_SEC / 60),
      });
      await this.email.sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
    } catch {
      // A failed send must not lock the person out.
      await this.redis.delete(this.tokenKey(token), cooldownKey);
      throw serviceUnavailable(
        'EMAIL_SEND_FAILED',
        'We could not send the reset email right now — please try again.',
      );
    }

    return { expiresInSec: TOKEN_TTL_SEC, resendInSec: RESEND_COOLDOWN_SEC };
  }

  /**
   * Validate the token, delete it (single-use), and return the email it was
   * issued for. Throws with a generic message so the caller cannot distinguish
   * "unknown token", "expired token" or "already used" from an attacker's
   * perspective — all three collapse into one 400.
   */
  async verifyAndConsume(token: string): Promise<string> {
    if (!token || typeof token !== 'string' || token.length < 32) {
      throw badRequest('PASSWORD_RESET_INVALID', 'This reset link is invalid or has expired.');
    }
    const key = this.tokenKey(token);
    const raw = await this.redis.get(key);
    if (!raw) {
      throw badRequest('PASSWORD_RESET_INVALID', 'This reset link is invalid or has expired.');
    }
    // Delete BEFORE returning — a crash between here and the password update
    // is safer than leaving the token consumable twice.
    await this.redis.delete(key);
    const stored = JSON.parse(raw) as StoredToken;
    return stored.email;
  }

  /**
   * Hash the plaintext token with a pepper (the JWT refresh secret is already
   * in the runtime and is 32+ bytes of high entropy). We store the HASH as the
   * Redis key so a Redis dump/leak doesn't hand an attacker usable tokens.
   */
  private tokenKey(token: string): string {
    const hash = createHash('sha256')
      .update(`${token}:${this.config.jwtRefreshSecret}`)
      .digest('hex');
    return `pwreset:tok:${hash}`;
  }

  private throttleKey(kind: 'cd' | 'hr', email: string): string {
    return `pwreset:${kind}:${email.toLowerCase()}`;
  }
}
