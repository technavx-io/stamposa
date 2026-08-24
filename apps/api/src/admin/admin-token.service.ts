import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { unauthorized } from '../common/exceptions';
import { AppConfigService } from '../config/app-config.service';
import { RedisService } from '../redis/redis.service';
import { AdminJwtPayload, AdminTokenType } from './admin.types';

/** Admin sessions are shorter-lived than tenant sessions, by policy. */
const ADMIN_ACCESS_TTL_SEC = 900; // 15 min
const ADMIN_REFRESH_TTL_SEC = 60 * 60 * 12; // 12 h — admins re-auth daily
const TWO_FACTOR_TTL_SEC = 300; // 5 min to complete the 2FA step
const MAX_CONCURRENT_SESSIONS = 3;

@Injectable()
export class AdminTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
  ) {}

  /** Interim token proving the password step passed; useless on its own. */
  issueTwoFactorToken(adminId: string, role: AdminRole): Promise<string> {
    return this.sign({ sub: adminId, type: 'admin_2fa', role }, TWO_FACTOR_TTL_SEC);
  }

  async verifyTwoFactorToken(token: string): Promise<AdminJwtPayload> {
    const payload = await this.verify(token);
    if (payload.type !== 'admin_2fa') {
      throw unauthorized('INVALID_TOKEN', 'Start again from the sign-in screen.');
    }
    return payload;
  }

  async issueSession(
    adminId: string,
    role: AdminRole,
  ): Promise<{ accessToken: string; refreshToken: string; accessTokenExpiresInSec: number }> {
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.sign({ sub: adminId, type: 'admin_access', role }, ADMIN_ACCESS_TTL_SEC),
      this.sign({ sub: adminId, type: 'admin_refresh', role, jti }, ADMIN_REFRESH_TTL_SEC),
    ]);

    await this.redis.setWithTtl(
      this.sessionKey(adminId, jti),
      JSON.stringify({ createdAt: new Date().toISOString() }),
      ADMIN_REFRESH_TTL_SEC,
    );
    await this.enforceSessionCap(adminId);

    return { accessToken, refreshToken, accessTokenExpiresInSec: ADMIN_ACCESS_TTL_SEC };
  }

  async refresh(refreshToken: string): Promise<{
    adminId: string;
    tokens: { accessToken: string; refreshToken: string; accessTokenExpiresInSec: number };
  }> {
    const payload = await this.verify(refreshToken);
    if (payload.type !== 'admin_refresh' || !payload.jti) {
      throw unauthorized('INVALID_TOKEN', 'Invalid token type.');
    }
    const key = this.sessionKey(payload.sub, payload.jti);
    if (!(await this.redis.exists(key))) {
      throw unauthorized('SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    }
    await this.redis.delete(key);
    return { adminId: payload.sub, tokens: await this.issueSession(payload.sub, payload.role) };
  }

  async revoke(refreshToken: string): Promise<void> {
    try {
      const payload = await this.verify(refreshToken);
      if (payload.jti) await this.redis.delete(this.sessionKey(payload.sub, payload.jti));
    } catch {
      // Already invalid — nothing to revoke.
    }
  }

  /** Kills every session for an admin (deactivation, forced sign-out). */
  async revokeAllForAdmin(adminId: string): Promise<void> {
    const keys = await this.redis.raw.keys(`adminsess:${adminId}:*`);
    if (keys.length > 0) await this.redis.delete(...keys);
  }

  async verifyAccessToken(token: string): Promise<AdminJwtPayload> {
    const payload = await this.verify(token);
    if (payload.type !== 'admin_access') {
      throw unauthorized('INVALID_TOKEN', 'Invalid token type.');
    }
    return payload;
  }

  async activeSessionCount(adminId: string): Promise<number> {
    return (await this.redis.raw.keys(`adminsess:${adminId}:*`)).length;
  }

  private async enforceSessionCap(adminId: string): Promise<void> {
    const keys = await this.redis.raw.keys(`adminsess:${adminId}:*`);
    if (keys.length <= MAX_CONCURRENT_SESSIONS) return;
    // Drop the oldest sessions beyond the cap.
    const withAges = await Promise.all(
      keys.map(async (k) => ({ key: k, ttl: await this.redis.ttl(k) })),
    );
    withAges
      .sort((a, b) => a.ttl - b.ttl)
      .slice(0, keys.length - MAX_CONCURRENT_SESSIONS)
      .forEach((entry) => void this.redis.delete(entry.key));
  }

  private sign(payload: AdminJwtPayload, ttlSec: number): Promise<string> {
    return this.jwt.signAsync(payload, {
      // Admin tokens are signed with the refresh secret so a leaked tenant
      // access secret can never mint an admin session.
      secret: this.config.jwtRefreshSecret,
      expiresIn: ttlSec,
    });
  }

  private async verify(token: string): Promise<AdminJwtPayload> {
    try {
      return await this.jwt.verifyAsync<AdminJwtPayload>(token, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch {
      throw unauthorized('SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    }
  }

  private sessionKey(adminId: string, jti: string): string {
    return `adminsess:${adminId}:${jti}`;
  }

  static tokenTypes(): AdminTokenType[] {
    return ['admin_access', 'admin_refresh', 'admin_2fa'];
  }
}
