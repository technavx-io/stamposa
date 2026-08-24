import { Module } from '@nestjs/common';
import { ApplePassService } from './apple-pass.service';
import { ApplePushService } from './apple-push.service';
import { GoogleWalletService } from './google-wallet.service';
import { AppleWebServiceController, CustomerWalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

/**
 * Wallet passes (Apple + Google). Deliberately depends only on Prisma and
 * config, so the loyalty domain can import it for change notifications
 * without a cycle.
 */
@Module({
  controllers: [CustomerWalletController, AppleWebServiceController],
  providers: [WalletService, ApplePassService, GoogleWalletService, ApplePushService],
  exports: [WalletService],
})
export class WalletModule {}
