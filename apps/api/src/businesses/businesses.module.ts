import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { QrModule } from '../qr/qr.module';
import { StorageModule } from '../storage/storage.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [QrModule, StorageModule, BillingModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
