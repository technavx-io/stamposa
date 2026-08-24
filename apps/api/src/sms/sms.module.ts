import { Logger, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ConsoleSmsProvider } from './console-sms.provider';
import { Msg91SmsProvider } from './msg91-sms.provider';
import { SMS_PROVIDER, SmsProvider } from './sms.types';

@Module({
  providers: [
    ConsoleSmsProvider,
    Msg91SmsProvider,
    {
      provide: SMS_PROVIDER,
      useFactory: (
        config: AppConfigService,
        consoleProvider: ConsoleSmsProvider,
        msg91: Msg91SmsProvider,
      ): SmsProvider => {
        switch (config.smsProvider) {
          case 'msg91':
            return msg91;
          case 'console':
          default:
            if (config.isProduction) {
              new Logger('SMS').warn(
                'SMS_PROVIDER=console in production — OTPs only appear in these logs and customers cannot sign in themselves. Configure MSG91 (docs/SMS-SETUP.md).',
              );
            }
            return consoleProvider;
        }
      },
      inject: [AppConfigService, ConsoleSmsProvider, Msg91SmsProvider],
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
