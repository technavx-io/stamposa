import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email.types';

/**
 * Development / staging fallback: logs the email instead of sending it. The
 * verification code is also surfaced on-screen (OTP_DEV_EXPOSE), so signup
 * is fully testable without SMTP configured.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email');

  async sendEmail(params: { to: string; subject: string; text: string }): Promise<void> {
    this.logger.log(`[console email] to=${params.to} · subject=${params.subject}\n${params.text}`);
  }
}
