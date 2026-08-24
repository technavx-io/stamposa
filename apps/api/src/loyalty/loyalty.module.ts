import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { MerchantCustomersController } from './merchant-customers.controller';
import { MerchantRedemptionsController } from './merchant-redemptions.controller';
import { CustomerCrmService } from './customer-crm.service';
import { MembershipsService } from './memberships.service';
import { RedemptionsService } from './redemptions.service';
import { StampsService } from './stamps.service';

/**
 * Core loyalty domain (cards, stamps, reward vouchers). The merchant
 * customer/reward views live here; the staff console and customer portal
 * import the services.
 */
@Module({
  imports: [WalletModule],
  controllers: [MerchantCustomersController, MerchantRedemptionsController],
  providers: [MembershipsService, StampsService, RedemptionsService, CustomerCrmService],
  exports: [MembershipsService, StampsService, RedemptionsService, CustomerCrmService],
})
export class LoyaltyModule {}
