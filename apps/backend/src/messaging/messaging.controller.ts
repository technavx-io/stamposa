import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Business, Merchant } from '@prisma/client';
import { CurrentMerchant, Roles } from '../auth/decorators/auth.decorators';
import { requireBusiness } from '../businesses/business.util';
import { BroadcastService } from './broadcast.service';
import { BroadcastAudienceDto, BroadcastDto, CreateBroadcastDto } from './dto/broadcast.dto';

type MerchantWithBusiness = Merchant & { business: Business | null };

@ApiTags('Merchant · Messaging')
@ApiBearerAuth()
@Roles('MERCHANT')
@Controller('merchant/messaging')
export class MessagingController {
  constructor(private readonly broadcasts: BroadcastService) {}

  @Get('audience')
  @ApiOperation({ summary: 'Reachable wallet audience and remaining monthly quota' })
  @ApiOkResponse({ type: BroadcastAudienceDto })
  audience(@CurrentMerchant() merchant: MerchantWithBusiness): Promise<BroadcastAudienceDto> {
    return this.broadcasts.audience(requireBusiness(merchant.business));
  }

  @Get('broadcasts')
  @ApiOperation({ summary: 'Recent broadcasts with delivery stats' })
  @ApiOkResponse({ type: BroadcastDto, isArray: true })
  list(@CurrentMerchant() merchant: MerchantWithBusiness): Promise<BroadcastDto[]> {
    return this.broadcasts.list(requireBusiness(merchant.business).id);
  }

  @Post('broadcasts')
  @ApiOperation({ summary: 'Send a wallet push broadcast to all card holders' })
  @ApiOkResponse({ type: BroadcastDto })
  send(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Body() dto: CreateBroadcastDto,
  ): Promise<BroadcastDto> {
    return this.broadcasts.send(requireBusiness(merchant.business), dto);
  }
}
