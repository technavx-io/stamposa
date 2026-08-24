import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { StaffConsoleController } from './staff-console.controller';
import { StaffConsoleService } from './staff-console.service';

@Module({
  imports: [LoyaltyModule, CampaignsModule, BusinessesModule],
  controllers: [StaffConsoleController],
  providers: [StaffConsoleService],
})
export class StaffConsoleModule {}
