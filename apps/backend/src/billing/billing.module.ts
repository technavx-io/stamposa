import { Module } from '@nestjs/common';
import {
  DodoWebhookController,
  MerchantSubscriptionController,
  PromoAdminController,
  PublicPlansController,
} from './billing.controller';
import { DodoService } from './dodo.service';
import { EntitlementsService } from './entitlements.service';
import { PromoService } from './promo.service';
import { SubscriptionService } from './subscription.service';

/**
 * Subscriptions, plan catalog, entitlements, promo codes and the Dodo Payments
 * integration. Exports the services other domains consume: SubscriptionService
 * (business creation seeds a trial) and EntitlementsService (feature gating).
 * Depends only on Prisma + config, so anyone can import it without a cycle.
 */
@Module({
  controllers: [
    PublicPlansController,
    MerchantSubscriptionController,
    DodoWebhookController,
    PromoAdminController,
  ],
  providers: [SubscriptionService, EntitlementsService, DodoService, PromoService],
  exports: [SubscriptionService, EntitlementsService],
})
export class BillingModule {}
