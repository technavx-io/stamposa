import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Business, Merchant } from '@prisma/client';
import { CurrentMerchant, Roles } from '../auth/decorators/auth.decorators';
import { requireBusiness } from '../businesses/business.util';
import { badRequest } from '../common/exceptions';
import { CampaignsService } from './campaigns.service';
import { CampaignDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

type MerchantWithBusiness = Merchant & { business: Business | null };

const CARD_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

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

  @Post(':id/card-image')
  @ApiOperation({ summary: "Upload/replace this campaign's card background image (max 4 MB)" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: CampaignDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CARD_IMAGE_MAX_BYTES } }))
  uploadCardImage(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<CampaignDto> {
    if (!file) throw badRequest('FILE_REQUIRED', 'Attach an image file named "file".');
    return this.campaigns.setCardImage(requireBusiness(merchant.business).id, id, file);
  }

  @Delete(':id/card-image')
  @ApiOperation({ summary: "Remove this campaign's card background image" })
  @ApiOkResponse({ type: CampaignDto })
  removeCardImage(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('id') id: string,
  ): Promise<CampaignDto> {
    return this.campaigns.removeCardImage(requireBusiness(merchant.business).id, id);
  }
}
