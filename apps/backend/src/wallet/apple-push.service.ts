import { readFileSync } from 'fs';
import { connect } from 'http2';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

const APNS_HOST = 'https://api.push.apple.com';

/**
 * Minimal APNs client for pass updates. Wallet pushes are empty payloads to
 * the pass type topic, authenticated with the SAME Pass Type ID certificate
 * that signs the passes — no extra Apple setup. The device responds by
 * calling our web service for the fresh pass.
 */
@Injectable()
export class ApplePushService {
  private readonly logger = new Logger(ApplePushService.name);

  constructor(private readonly config: AppConfigService) {}

  async notify(pushTokens: string[]): Promise<void> {
    const cfg = this.config.appleWallet;
    if (!cfg || pushTokens.length === 0) return;

    let cert: Buffer, key: Buffer;
    try {
      cert = readFileSync(cfg.certPath);
      key = readFileSync(cfg.keyPath);
    } catch (e) {
      this.logger.warn(`APNs certificate unreadable: ${(e as Error).message}`);
      return;
    }

    await new Promise<void>((resolve) => {
      const client = connect(APNS_HOST, {
        cert,
        key,
        passphrase: cfg.keyPassphrase,
      });
      client.on('error', (e) => {
        this.logger.warn(`APNs connection failed: ${e.message}`);
        resolve();
      });

      let remaining = pushTokens.length;
      const done = () => {
        if (--remaining === 0) {
          client.close();
          resolve();
        }
      };

      for (const token of pushTokens) {
        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${token}`,
          'apns-topic': cfg.passTypeId,
          'apns-push-type': 'background',
        });
        req.setTimeout(5000, () => {
          req.close();
          done();
        });
        req.on('response', (headers) => {
          const status = headers[':status'];
          if (status !== 200) this.logger.warn(`APNs push to …${token.slice(-6)}: ${status}`);
        });
        req.on('error', () => done());
        req.on('close', () => done());
        req.end('{}');
      }
    });
  }
}
