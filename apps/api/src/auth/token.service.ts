import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { unauthorized } from '../common/exceptions';
import { AppConfigService } from '../config/app-config.service';
import { RedisService } from '../redis/redis.service';
import { ActorRole, ImpersonationClaim, IssuedTokens, JwtPayload } from './auth.types';

const REGISTRATION_TOKEN_TTL_SEC = 600;

/**
 * Access tokens are short-lived and stateless. Refresh tokens are long-lived
 * and stateful: each carries a jti that must exist in Redis
 * (sess:{role}:{actorId}:{jti}), so sessions are individually revocable and
 * rotated on every refresh.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Issues an access+refresh pair. Impersonated sessions carry the claim in
   * BOTH tokens and every TTL is clamped to the support session's end, so an
   * impersonation token can never outlive the 30-minute window it audits to.
   */
  async issueSession(
    role: ActorRole,
    actorId: string,
    opts?: { impersonation?: ImpersonationClaim },
  ): Promise<IssuedTokens> {
    const jti = randomUUID();
    const imp = opts?.impersonation;
    const clamp = (ttlSec: number): number => {
      if (!imp) return ttlSec;
      const remaining = Math.floor((new Date(imp.expiresAt).getTime() - Date.now()) / 1000);
      return Math.max(1, Math.min(ttlSec, remaining));
    };
    const accessTtl = clamp(this.config.jwtAccessTtlSec);
    const refreshTtl = clamp(this.config.jwtRefreshTtlSec);

    const accessPayload: JwtPayload = { sub: actorId, role, type: 'access', ...(imp ? { imp } : {}) };
    const refreshPayload: JwtPayload = { sub: actorId, role, type: 'refresh', jti, ...(imp ? { imp } : {}) };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.jwtAccessSecret,
        expiresIn: accessTtl,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.jwtRefreshSecret,
        expiresIn: refreshTtl,
      }),
    ]);

    await this.redis.setWithTtl(
      this.sessionKey(role, actorId, jti),
      JSON.stringify({ createdAt: new Date().toISOString(), impersonated: !!imp }),
      refreshTtl,
    );

    return { accessToken, refreshToken, accessTokenExpiresInSec: accessTtl };
  }

  /** Verifies + rotates a refresh token (old session is revoked atomically). */
  async refreshSession(refreshToken: string): Promise<{ role: ActorRole; actorId: string; tokens: IssuedTokens }> {
    const payload = await this.verifyRefresh(refreshToken);
    const key = this.sessionKey(payload.role, payload.sub, payload.jti as string);
    const exists = await this.redis.exists(key);
    if (!exists) {
      throw unauthorized('SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    }
    await this.redis.delete(key);
    // An impersonated session stays impersonated across refreshes.
    const tokens = await this.issueSession(payload.role, payload.sub, {
      impersonation: payload.imp,
    });
    return { role: payload.role, actorId: payload.sub, tokens };
  }

  /** Revokes the session; silently succeeds for already-invalid tokens. */
  async revokeSession(refreshToken: string): Promise<void> {
    try {
      const payload = await this.verifyRefresh(refreshToken);
      await this.redis.delete(this.sessionKey(payload.role, payload.sub, payload.jti as string));
    } catch {
      // Nothing to revoke.
    }
  }

  /** Short-lived proof that a phone was OTP-verified but has no account yet. */
  async issueRegistrationToken(role: ActorRole, phoneE164: string): Promise<string> {
    const payload: JwtPayload = { sub: phoneE164, role, type: 'registration' };
    return this.jwt.signAsync(payload, {
      secret: this.config.jwtAccessSecret,
      expiresIn: REGISTRATION_TOKEN_TTL_SEC,
    });
  }

  async verifyRegistrationToken(token: string, role: ActorRole): Promise<string> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.jwtAccessSecret,
      });
    } catch {
      throw unauthorized('REGISTRATION_EXPIRED', 'Verification expired. Start again.');
    }
    if (payload.type !== 'registration' || payload.role !== role) {
      throw unauthorized('REGISTRATION_INVALID', 'Invalid registration token.');
    }
    return payload.sub;
  }

  private async verifyRefresh(token: string): Promise<JwtPayload> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch {
      throw unauthorized('SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    }
    if (payload.type !== 'refresh' || !payload.jti) {
      throw unauthorized('INVALID_TOKEN', 'Invalid token type.');
    }
    return payload;
  }

  private sessionKey(role: ActorRole, actorId: string, jti: string): string {
    return `sess:${role}:${actorId}:${jti}`;
  }
}
