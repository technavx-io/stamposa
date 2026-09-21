import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { StaffManagementController } from './staff-management.controller';
import { StaffManagementService } from './staff-management.service';

@Module({
  // AuthModule exports TokenService so we can revoke a staff member's live
  // sessions when their password is reset (bug #N4 — password reset must lock
  // out anyone holding the previous refresh token).
  imports: [BillingModule, AuthModule],
  controllers: [StaffManagementController],
  providers: [StaffManagementService],
})
export class StaffManagementModule {}
