import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { QrModule } from '../qr/qr.module';
import { CustomerPortalController } from './customer-portal.controller';

@Module({
  imports: [LoyaltyModule, QrModule],
  controllers: [CustomerPortalController],
})
export class CustomerPortalModule {}
