import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { StaffConsoleController } from './staff-console.controller';
import { StaffConsoleService } from './staff-console.service';

@Module({
  // AuthModule exports TokenService so a staff self-service password change
  // can revoke every existing refresh token for that staff (bug #N4).
  imports: [LoyaltyModule, CampaignsModule, BusinessesModule, AuthModule],
  controllers: [StaffConsoleController],
  providers: [StaffConsoleService],
})
export class StaffConsoleModule {}
