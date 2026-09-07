import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Business, Merchant, StampIssuerType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentMerchant, Roles } from '../auth/decorators/auth.decorators';
import { RequestContext } from '../admin/decorators/admin.decorators';
import { CustomerCrmService } from './customer-crm.service';
import { requireBusiness } from '../businesses/business.util';
import { ApiOkResponsePaginated, PaginatedDto, PaginationQueryDto } from '../common/dto/pagination.dto';
import {
  AddStampResultDto,
  MembershipDetailDto,
  MembershipListItemDto,
  StampDto,
} from './dto/loyalty.dto';
import { MembershipsService } from './memberships.service';
import { StampsService } from './stamps.service';

class CustomerListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches name, phone digits or customer code' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}

class UpdateCustomerDto {
  @ApiPropertyOptional({ description: 'Private notes, visible only to the business' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ isArray: true, type: String, example: ['regular', 'birthday-march'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

class AdjustBalanceDto {
  @ApiProperty({ example: -2, description: 'Whole number, positive or negative' })
  @Type(() => Number)
  @IsInt()
  delta: number;

  @ApiProperty({ example: 'Stamped twice by mistake at the counter' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(4, 200, { message: 'Give a short reason — it appears in the customer’s history.' })
  reason: string;
}

class BlockCustomerDto {
  @ApiProperty({ description: 'True to block, false to unblock' })
  @IsBoolean()
  blocked: boolean;

  @ApiPropertyOptional({ example: 'Repeated abuse of the referral bonus' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

interface Meta {
  ipAddress: string | null;
  userAgent: string | null;
}

type MerchantWithBusiness = Merchant & { business: Business | null };

@ApiTags('Merchant · Customers')
@ApiBearerAuth()
@Roles('MERCHANT')
@Controller('merchant/customers')
export class MerchantCustomersController {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly stamps: StampsService,
    private readonly crm: CustomerCrmService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List/search customers of this business (paginated)' })
  @ApiOkResponsePaginated(MembershipListItemDto)
  list(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Query() query: CustomerListQueryDto,
  ): Promise<PaginatedDto<MembershipListItemDto>> {
    const business = requireBusiness(merchant.business);
    return this.memberships.listForBusiness(business.id, {
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':membershipId')
  @ApiOperation({ summary: 'Customer detail (card state + campaign)' })
  @ApiOkResponse({ type: MembershipDetailDto })
  detail(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('membershipId') membershipId: string,
  ): Promise<MembershipDetailDto> {
    const business = requireBusiness(merchant.business);
    return this.memberships.detailForBusiness(business.id, membershipId);
  }

  @Get(':membershipId/stamps')
  @ApiOperation({ summary: 'Stamp history for a customer (paginated, newest first)' })
  @ApiOkResponsePaginated(StampDto)
  stampHistory(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('membershipId') membershipId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<StampDto>> {
    const business = requireBusiness(merchant.business);
    return this.memberships.stampsForBusiness(business.id, membershipId, {
      page: query.page,
      limit: query.limit,
    });
  }

  @Post(':membershipId/stamps')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add one stamp as the owner (solo merchants without staff)' })
  @ApiOkResponse({ type: AddStampResultDto })
  addStamp(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('membershipId') membershipId: string,
  ): Promise<AddStampResultDto> {
    const business = requireBusiness(merchant.business);
    return this.stamps.addStamp({
      businessId: business.id,
      membershipId,
      issuerType: StampIssuerType.MERCHANT,
    });
  }

  @Patch(':membershipId')
  @ApiOperation({ summary: 'Update private notes and tags' })
  @ApiOkResponse({ type: MembershipDetailDto })
  updateCustomer(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateCustomerDto,
    @RequestContext() meta: Meta,
  ): Promise<MembershipDetailDto> {
    const business = requireBusiness(merchant.business);
    return this.crm.updateProfile(business.id, membershipId, dto, { merchant, ...meta });
  }

  @Post(':membershipId/adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Correct a balance by ±N with a mandatory reason (recorded in the ledger)',
  })
  adjust(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('membershipId') membershipId: string,
    @Body() dto: AdjustBalanceDto,
    @RequestContext() meta: Meta,
  ) {
    const business = requireBusiness(merchant.business);
    return this.crm.adjustBalance(business.id, membershipId, dto.delta, dto.reason, {
      merchant,
      ...meta,
    });
  }

  @Post(':membershipId/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block or unblock a customer. Blocked members keep their history.' })
  @ApiOkResponse({ type: MembershipDetailDto })
  block(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('membershipId') membershipId: string,
    @Body() dto: BlockCustomerDto,
    @RequestContext() meta: Meta,
  ): Promise<MembershipDetailDto> {
    const business = requireBusiness(merchant.business);
    return this.crm.setBlocked(business.id, membershipId, dto.blocked, dto.reason, {
      merchant,
      ...meta,
    });
  }

  @Get(':membershipId/consents')
  @ApiOperation({ summary: 'Consent history — what they agreed to and when' })
  consents(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('membershipId') membershipId: string,
  ) {
    const business = requireBusiness(merchant.business);
    return this.crm.consentHistory(business.id, membershipId);
  }
}
