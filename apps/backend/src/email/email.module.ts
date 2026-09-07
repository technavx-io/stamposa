import { Logger, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ConsoleEmailProvider } from './console-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';
import { EMAIL_PROVIDER, EmailProvider } from './email.types';

@Module({
  providers: [
    ConsoleEmailProvider,
    SmtpEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        config: AppConfigService,
        consoleProvider: ConsoleEmailProvider,
        smtp: SmtpEmailProvider,
      ): EmailProvider => {
        switch (config.emailProvider) {
          case 'smtp':
            return smtp;
          case 'console':
          default:
            if (config.isProduction) {
              new Logger('Email').warn(
                'EMAIL_PROVIDER=console in production — verification emails are only logged, so merchants cannot confirm their email. Configure SMTP.',
              );
            }
            return consoleProvider;
        }
      },
      inject: [AppConfigService, ConsoleEmailProvider, SmtpEmailProvider],
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
