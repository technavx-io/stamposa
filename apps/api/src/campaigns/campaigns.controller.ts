import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Business, Merchant } from '@prisma/client';
import { CurrentMerchant, Roles } from '../auth/decorators/auth.decorators';
import { requireBusiness } from '../businesses/business.util';
import { CampaignsService } from './campaigns.service';
import { CampaignDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

type MerchantWithBusiness = Merchant & { business: Business | null };

@ApiTags('Merchant · Campaigns')
@ApiBearerAuth()
@Roles('MERCHANT')
@Controller('merchant/campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create the loyalty campaign (one live campaign in Phase 1)' })
  @ApiOkResponse({ type: CampaignDto })
  create(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Body() dto: CreateCampaignDto,
  ): Promise<CampaignDto> {
    return this.campaigns.create(requireBusiness(merchant.business).id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List campaigns (newest first)' })
  @ApiOkResponse({ type: CampaignDto, isArray: true })
  list(@CurrentMerchant() merchant: MerchantWithBusiness): Promise<CampaignDto[]> {
    return this.campaigns.list(requireBusiness(merchant.business).id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one campaign' })
  @ApiOkResponse({ type: CampaignDto })
  get(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('id') id: string,
  ): Promise<CampaignDto> {
    return this.campaigns.get(requireBusiness(merchant.business).id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update campaign details, pause/resume or archive' })
  @ApiOkResponse({ type: CampaignDto })
  update(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ): Promise<CampaignDto> {
    return this.campaigns.update(requireBusiness(merchant.business).id, id, dto);
  }
}
