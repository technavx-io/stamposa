import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [CampaignsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
