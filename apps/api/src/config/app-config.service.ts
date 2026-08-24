import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { Env } from './env';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get redisUrl(): string {
    return this.config.get('REDIS_URL', { infer: true });
  }

  get jwtAccessSecret(): string {
    return this.config.get('JWT_ACCESS_SECRET', { infer: true });
  }

  get jwtRefreshSecret(): string {
    return this.config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  get jwtAccessTtlSec(): number {
    return this.config.get('JWT_ACCESS_TTL_SEC', { infer: true });
  }

  get jwtRefreshTtlSec(): number {
    return this.config.get('JWT_REFRESH_TTL_SEC', { infer: true });
  }

  get webAppUrl(): string {
    return this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
  }

  get apiPublicUrl(): string {
    return this.config.get('API_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  get corsOrigins(): string[] {
    return this.config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  /** Absolute path so behaviour doesn't depend on the process cwd. */
  get uploadDir(): string {
    return resolve(process.cwd(), this.config.get('UPLOAD_DIR', { infer: true }));
  }

  get smsProvider(): Env['SMS_PROVIDER'] {
    return this.config.get('SMS_PROVIDER', { infer: true });
  }

  /** Hard-disabled in production regardless of the env flag. */
  /** MSG91 credentials, or null when any piece is missing. */
  get msg91(): { authKey: string; templateId: string; senderId: string } | null {
    const authKey = this.config.get('MSG91_AUTH_KEY', { infer: true });
    const templateId = this.config.get('MSG91_TEMPLATE_ID', { infer: true });
    const senderId = this.config.get('MSG91_SENDER_ID', { infer: true });
    if (!authKey || !templateId || !senderId) return null;
    return { authKey, templateId, senderId };
  }

  get otpDevExpose(): boolean {
    return !this.isProduction && this.config.get('OTP_DEV_EXPOSE', { infer: true });
  }

  get defaultPhoneRegion(): string {
    return this.config.get('DEFAULT_PHONE_REGION', { infer: true });
  }

  /** Always true in production — the env schema refuses to load otherwise. */
  /** Apple Wallet config, or null when any piece is missing. */
  get appleWallet(): {
    certPath: string;
    keyPath: string;
    keyPassphrase?: string;
    wwdrPath: string;
    teamId: string;
    passTypeId: string;
  } | null {
    const g = <K extends keyof Env>(key: K): Env[K] => this.config.get(key, { infer: true });
    const certPath = g('APPLE_WALLET_CERT_PATH');
    const keyPath = g('APPLE_WALLET_KEY_PATH');
    const wwdrPath = g('APPLE_WALLET_WWDR_PATH');
    const teamId = g('APPLE_WALLET_TEAM_ID');
    const passTypeId = g('APPLE_WALLET_PASS_TYPE_ID');
    if (!certPath || !keyPath || !wwdrPath || !teamId || !passTypeId) return null;
    return {
      certPath,
      keyPath,
      keyPassphrase: g('APPLE_WALLET_KEY_PASSPHRASE'),
      wwdrPath,
      teamId,
      passTypeId,
    };
  }

  /** Google Wallet config, or null when any piece is missing. */
  get googleWallet(): { issuerId: string; saKeyPath: string } | null {
    const issuerId = this.config.get('GOOGLE_WALLET_ISSUER_ID', { infer: true });
    const saKeyPath = this.config.get('GOOGLE_WALLET_SA_KEY_PATH', { infer: true });
    if (!issuerId || !saKeyPath) return null;
    return { issuerId, saKeyPath };
  }

  get adminRequireTwoFactor(): boolean {
    if (this.isProduction) return true;
    return this.config.get('ADMIN_REQUIRE_2FA', { infer: true });
  }
}
