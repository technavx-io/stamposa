import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { BroadcastService } from './broadcast.service';
import { MessagingController } from './messaging.controller';

/**
 * Merchant-facing messaging. Today this is wallet push broadcasts, built on
 * WalletService's fan-out; email/SMS campaigns can join later.
 */
@Module({
  imports: [WalletModule],
  controllers: [MessagingController],
  providers: [BroadcastService],
})
export class MessagingModule {}
