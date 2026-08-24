import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.types';

/** Development provider: prints the SMS to the API log instead of sending. */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');

  async sendOtp(phoneE164: string, _code: string, message: string): Promise<void> {
    this.logger.log(`→ ${phoneE164}: ${message}`);
  }
}
