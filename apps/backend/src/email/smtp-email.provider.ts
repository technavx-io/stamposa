import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfigService } from '../config/app-config.service';
import { EmailProvider } from './email.types';

/** SMTP delivery via nodemailer — works with Gmail app-passwords or any mail domain. */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email');
  private transporter: Transporter | null = null;
  private from = '';

  private get client(): Transporter {
    if (this.transporter) return this.transporter;
    const smtp = this.config.smtp;
    if (!smtp) {
      throw new Error('EMAIL_PROVIDER=smtp but SMTP settings are incomplete.');
    }
    this.from = smtp.from;
    this.transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    return this.transporter;
  }

  constructor(private readonly config: AppConfigService) {}

  async sendEmail(params: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    try {
      await this.client.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
    } catch (err) {
      this.logger.error(`SMTP send to ${params.to} failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
