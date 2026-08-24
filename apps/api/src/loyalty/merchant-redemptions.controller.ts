import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Business, Merchant, RedemptionStatus, StampIssuerType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentMerchant, Roles } from '../auth/decorators/auth.decorators';
import { requireBusiness } from '../businesses/business.util';
import { ApiOkResponsePaginated, PaginatedDto, PaginationQueryDto } from '../common/dto/pagination.dto';
import { RedeemResultDto, RedemptionRowDto } from './dto/loyalty.dto';
import { RedeemRequestDto } from './dto/redeem-request.dto';
import { RedemptionsService } from './redemptions.service';

class RedemptionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RedemptionStatus, description: 'Filter by voucher status' })
  @IsOptional()
  @IsEnum(RedemptionStatus)
  status?: RedemptionStatus;

  @ApiPropertyOptional({ description: 'Customer name, phone digits, customer code or voucher code' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}

type MerchantWithBusiness = Merchant & { business: Business | null };

@ApiTags('Merchant · Rewards')
@ApiBearerAuth()
@Roles('MERCHANT')
@Controller('merchant/redemptions')
export class MerchantRedemptionsController {
  constructor(private readonly redemptions: RedemptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List reward vouchers (pending first, newest first)' })
  @ApiOkResponsePaginated(RedemptionRowDto)
  list(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Query() query: RedemptionListQueryDto,
  ): Promise<PaginatedDto<RedemptionRowDto>> {
    const business = requireBusiness(merchant.business);
    return this.redemptions.listForBusiness({
      businessId: business.id,
      status: query.status,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a voucher as handed over, as the owner' })
  @ApiOkResponse({ type: RedeemResultDto })
  redeem(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Body() dto: RedeemRequestDto,
  ): Promise<RedeemResultDto> {
    const business = requireBusiness(merchant.business);
    return this.redemptions.redeem({
      businessId: business.id,
      redemptionId: dto.redemptionId,
      code: dto.code,
      redeemerType: StampIssuerType.MERCHANT,
    });
  }
}
