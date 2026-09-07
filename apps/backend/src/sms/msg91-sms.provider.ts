import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { SmsProvider } from './sms.types';

const FLOW_URL = 'https://control.msg91.com/api/v5/flow';
const TIMEOUT_MS = 10_000;

/**
 * MSG91 Flow API — the DLT-compliant way to send transactional SMS in
 * India. The message text lives in the DLT-approved template (which must
 * contain the ##otp## variable); we only transmit the code.
 */
@Injectable()
export class Msg91SmsProvider implements SmsProvider {
  private readonly logger = new Logger('MSG91');

  constructor(private readonly config: AppConfigService) {}

  async sendOtp(phoneE164: string, code: string, _message: string): Promise<void> {
    const cfg = this.config.msg91;
    if (!cfg) throw new Error('MSG91 is not configured');

    // MSG91 wants bare digits with the country code: 919876543210.
    const mobiles = phoneE164.replace(/^\+/, '');

    const res = await fetch(FLOW_URL, {
      method: 'POST',
      headers: {
        authkey: cfg.authKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        template_id: cfg.templateId,
        sender: cfg.senderId,
        short_url: '0',
        recipients: [{ mobiles, otp: code }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = (await res.json().catch(() => null)) as {
      type?: string;
      message?: string;
    } | null;

    if (!res.ok || body?.type !== 'success') {
      // Never log the code — only the gateway's own response.
      this.logger.error(
        `send to …${mobiles.slice(-4)} failed: http ${res.status} ${JSON.stringify(body)}`,
      );
      throw new Error(`MSG91 rejected the message (${body?.message ?? res.status})`);
    }

    this.logger.log(`→ …${mobiles.slice(-4)} accepted (request ${body.message})`);
  }
}
