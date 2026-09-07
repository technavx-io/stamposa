import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Business, Merchant } from '@prisma/client';
import { CurrentMerchant, Roles } from '../auth/decorators/auth.decorators';
import { requireBusiness } from '../businesses/business.util';
import { DashboardDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

type MerchantWithBusiness = Merchant & { business: Business | null };

@ApiTags('Merchant · Dashboard')
@ApiBearerAuth()
@Roles('MERCHANT')
@Controller('merchant/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Overview stats, live activity and setup checklist' })
  @ApiOkResponse({ type: DashboardDto })
  overview(@CurrentMerchant() merchant: MerchantWithBusiness): Promise<DashboardDto> {
    return this.dashboard.overview(requireBusiness(merchant.business));
  }
}
