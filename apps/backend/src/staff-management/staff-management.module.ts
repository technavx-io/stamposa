import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { StaffManagementController } from './staff-management.controller';
import { StaffManagementService } from './staff-management.service';

@Module({
  imports: [BillingModule],
  controllers: [StaffManagementController],
  providers: [StaffManagementService],
})
export class StaffManagementModule {}
