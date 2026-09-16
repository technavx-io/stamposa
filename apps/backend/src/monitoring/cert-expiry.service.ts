import { readFile } from 'fs/promises';
import * as tls from 'tls';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import forge from 'node-forge';
import type Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email.types';
import { REDIS_CLIENT } from '../redis/redis.constants';

/**
 * Daily check of every certificate that, once expired, would take a wallet
 * pass or a public host offline. Emails ALERT_EMAIL when any of them has
 * fewer than 30 days left. Redis-deduped so the same warning does not send
 * twice in 24 hours.
 *
 * Reads are pure I/O (no shell dependencies): node-forge for local PEMs,
 * built-in tls for the three public subdomains.
 */
@Injectable()
export class CertExpiryService implements OnModuleInit {
  private readonly logger = new Logger(CertExpiryService.name);
  private static readonly WARN_DAYS = 30;
  private static readonly DEDUPE_TTL_SEC = 20 * 60 * 60; // 20h — ~1 alert / day
  private static readonly CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
  private static readonly TLS_HOSTS: ReadonlyArray<{ name: string; host: string }> = [
    { name: 'website-tls', host: 'stamposa.com' },
    { name: 'app-tls', host: 'app.stamposa.com' },
    { name: 'api-tls', host: 'api.stamposa.com' },
  ];

  constructor(
    private readonly config: AppConfigService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit() {
    // Delay the first run so app startup is not blocked by network I/O.
    setTimeout(() => void this.runAll(), 60_000);
    setInterval(() => void this.runAll(), CertExpiryService.CHECK_INTERVAL_MS);
  }

  /** Exposed so a health/ops route or a test can trigger a check manually. */
  async runAll(): Promise<void> {
    const results = await Promise.allSettled([
      this.checkLocalPem('apple-wallet-cert', this.config.appleWallet?.certPath),
      this.checkLocalPem('apple-wallet-wwdr', this.config.appleWallet?.wwdrPath),
      ...CertExpiryService.TLS_HOSTS.map(({ name, host }) => this.checkTls(name, host)),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') {
        this.logger.warn(`Cert check failed: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      }
    }
  }

  private async checkLocalPem(name: string, path: string | undefined): Promise<void> {
    if (!path) return; // wallet not configured — nothing to watch
    const pem = await readFile(path, 'utf8');
    const cert = forge.pki.certificateFromPem(pem);
    await this.evaluate(name, path, cert.validity.notAfter);
  }

  private checkTls(name: string, host: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const socket = tls.connect(
        { host, port: 443, servername: host, timeout: 10_000 },
        () => {
          const cert = socket.getPeerCertificate();
          socket.end();
          if (!cert || !cert.valid_to) {
            reject(new Error(`no peer certificate for ${host}`));
            return;
          }
          this.evaluate(name, host, new Date(cert.valid_to)).then(resolve, reject);
        },
      );
      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`TLS timeout for ${host}`));
      });
    });
  }

  private async evaluate(name: string, target: string, notAfter: Date): Promise<void> {
    const msLeft = notAfter.getTime() - Date.now();
    const daysLeft = Math.floor(msLeft / 86_400_000);
    if (daysLeft > CertExpiryService.WARN_DAYS) {
      this.logger.log(`Cert ${name} OK — ${daysLeft} days remaining (${target})`);
      return;
    }
    await this.alertOnce(name, target, daysLeft, notAfter);
  }

  private async alertOnce(name: string, target: string, daysLeft: number, notAfter: Date): Promise<void> {
    const to = this.config.alertEmail;
    if (!to) {
      this.logger.warn(
        `Cert ${name} expires in ${daysLeft} days but ALERT_EMAIL is unset — no email will be sent (${target})`,
      );
      return;
    }
    // Only send one email per 20 hours per cert.
    const dedupeKey = `cert-alert:${name}`;
    const set = await this.redis.set(dedupeKey, '1', 'EX', CertExpiryService.DEDUPE_TTL_SEC, 'NX');
    if (set !== 'OK') {
      this.logger.log(`Cert ${name} alert suppressed by dedupe (${daysLeft} days remaining)`);
      return;
    }
    const urgency = daysLeft <= 7 ? 'URGENT' : 'warning';
    const subject = `[Stamposa] ${urgency}: ${name} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    const text =
      `Certificate "${name}" (${target}) expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} ` +
      `(at ${notAfter.toISOString()}).\n\n` +
      `Rotate before then to avoid an outage.\n\n` +
      `Origin: Stamposa API cert-expiry monitor.`;
    try {
      await this.email.sendEmail({ to, subject, text });
      this.logger.warn(`Sent cert-expiry alert for ${name} — ${daysLeft} days remaining`);
    } catch (err) {
      this.logger.error(
        `Failed to send cert-expiry alert for ${name}: ${err instanceof Error ? err.message : err}`,
      );
      // Release the dedupe lock so the next tick retries.
      await this.redis.del(dedupeKey);
    }
  }
}
