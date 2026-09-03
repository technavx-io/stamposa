import { Module } from '@nestjs/common';
import {
  DodoWebhookController,
  MerchantSubscriptionController,
  PublicPlansController,
} from './billing.controller';
import { DodoService } from './dodo.service';
import { EntitlementsService } from './entitlements.service';
import { SubscriptionService } from './subscription.service';

/**
 * Subscriptions, plan catalog, entitlements and the Dodo Payments integration.
 * Exports the services other domains consume: SubscriptionService (business
 * creation seeds a trial) and EntitlementsService (feature gating). Depends
 * only on Prisma + config, so anyone can import it without a cycle.
 */
@Module({
  controllers: [PublicPlansController, MerchantSubscriptionController, DodoWebhookController],
  providers: [SubscriptionService, EntitlementsService, DodoService],
  exports: [SubscriptionService, EntitlementsService],
})
export class BillingModule {}
