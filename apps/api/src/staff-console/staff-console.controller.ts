import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Business, Staff, StaffRole, StampIssuerType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CurrentStaff, Roles } from '../auth/decorators/auth.decorators';
import { BusinessesService } from '../businesses/businesses.service';
import { BusinessDto } from '../businesses/dto/business.dto';
import { CampaignsService } from '../campaigns/campaigns.service';
import { PhoneService } from '../common/phone.service';
import {
  AddStampResultDto,
  CardCampaignDto,
  EnrollResultDto,
  MembershipListItemDto,
  RedeemResultDto,
  UndoStampResultDto,
} from '../loyalty/dto/loyalty.dto';
import { RedeemRequestDto } from '../loyalty/dto/redeem-request.dto';
import { MembershipsService } from '../loyalty/memberships.service';
import { RedemptionsService } from '../loyalty/redemptions.service';
import { StampsService } from '../loyalty/stamps.service';
import { StaffConsoleService } from './staff-console.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class StaffSelfDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ enum: StaffRole, description: 'MANAGER unlocks team stats and longer undo' })
  role: StaffRole;
}

class StaffContextDto {
  @ApiProperty({ type: StaffSelfDto })
  staff: StaffSelfDto;

  @ApiProperty({ type: BusinessDto })
  business: BusinessDto;

  @ApiProperty({ type: CardCampaignDto, nullable: true, description: 'Campaign stamps are added to (null when none active)' })
  campaign: CardCampaignDto | null;
}

class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Phone digits, customer code or name. Empty = recently stamped.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}

class AddStampDto {
  @ApiProperty({ description: 'Membership id from a search result' })
  @IsString()
  @MinLength(10)
  membershipId: string;
}

class UndoStampDto {
  @ApiProperty({ description: 'Membership id whose latest stamp should be taken back' })
  @IsString()
  @MinLength(10)
  membershipId: string;
}

class EnrollDto {
  @ApiProperty({ example: '+91 98765 43210', description: "The customer's phone" })
  @IsString()
  @Transform(trim)
  @MinLength(6)
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ example: 'Asha Patel' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(2, 60)
  name?: string;

  @ApiPropertyOptional({
    description: 'Only send true when the customer explicitly agreed at the counter.',
  })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}

class TodayMineDto {
  @ApiProperty({ example: 34, description: 'Net stamps issued today (undos subtract)' })
  stamps: number;

  @ApiProperty({ example: 3 })
  redemptions: number;
}

class TodayTotalsDto {
  @ApiProperty({ example: 61 })
  stamps: number;

  @ApiProperty({ example: 5 })
  newCustomers: number;

  @ApiProperty({ example: 4 })
  rewardsRedeemed: number;
}

class TodayTeamMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Meera Iyer' })
  name: string;

  @ApiProperty({ example: 27 })
  stamps: number;

  @ApiProperty({ example: 2 })
  redemptions: number;
}

class TodayDto {
  @ApiProperty({ type: TodayMineDto })
  mine: TodayMineDto;

  @ApiProperty({ type: TodayTotalsDto, nullable: true, description: 'Managers only' })
  totals: TodayTotalsDto | null;

  @ApiProperty({ type: TodayTeamMemberDto, isArray: true, nullable: true, description: 'Managers only' })
  team: TodayTeamMemberDto[] | null;
}

type StaffWithBusiness = Staff & { business: Business };

@ApiTags('Staff console')
@ApiBearerAuth()
@Roles('STAFF')
@Controller('staff')
export class StaffConsoleController {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly stamps: StampsService,
    private readonly redemptions: RedemptionsService,
    private readonly campaigns: CampaignsService,
    private readonly businesses: BusinessesService,
    private readonly console: StaffConsoleService,
    private readonly phones: PhoneService,
  ) {}

  @Get('context')
  @ApiOperation({ summary: 'Who am I, which business, which campaign is live' })
  @ApiOkResponse({ type: StaffContextDto })
  async context(@CurrentStaff() staff: StaffWithBusiness): Promise<StaffContextDto> {
    const campaign = await this.campaigns.activeCampaign(staff.businessId);
    return {
      staff: { id: staff.id, name: staff.name, phone: staff.phone, role: staff.role },
      business: this.businesses.dto(staff.business),
      campaign: campaign
        ? {
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            stampsRequired: campaign.stampsRequired,
            reward: campaign.reward,
            status: campaign.status,
          }
        : null,
    };
  }

  @Get('today')
  @ApiOperation({ summary: "Today's counter numbers (managers also get team breakdown)" })
  @ApiOkResponse({ type: TodayDto })
  today(@CurrentStaff() staff: StaffWithBusiness): Promise<TodayDto> {
    return this.console.today(staff);
  }

  @Get('customers/search')
  @ApiOperation({ summary: 'Find a customer by phone, code or name (own business only)' })
  @ApiOkResponse({ type: MembershipListItemDto, isArray: true })
  search(
    @CurrentStaff() staff: StaffWithBusiness,
    @Query() query: SearchQueryDto,
  ): Promise<MembershipListItemDto[]> {
    return this.memberships.searchForBusiness(staff.businessId, query.q ?? '');
  }

  @Post('enroll')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enrol a customer at the counter by phone (no OTP needed)' })
  @ApiOkResponse({ type: EnrollResultDto })
  enroll(
    @CurrentStaff() staff: StaffWithBusiness,
    @Body() dto: EnrollDto,
    @Req() req: { ip?: string },
  ): Promise<EnrollResultDto> {
    return this.memberships.enrollAtCounter({
      businessId: staff.businessId,
      phone: this.phones.normalize(dto.phone),
      name: dto.name,
      marketingConsent: dto.marketingConsent,
      staffId: staff.id,
      staffName: staff.name,
      ipAddress: req.ip ?? null,
    });
  }

  @Post('stamps')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add one stamp to a customer card' })
  @ApiOkResponse({ type: AddStampResultDto })
  addStamp(
    @CurrentStaff() staff: StaffWithBusiness,
    @Body() dto: AddStampDto,
  ): Promise<AddStampResultDto> {
    return this.stamps.addStamp({
      businessId: staff.businessId,
      membershipId: dto.membershipId,
      issuerType: StampIssuerType.STAFF,
      staffId: staff.id,
    });
  }

  @Post('stamps/undo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Undo the latest stamp on a card (own within 60 s; managers any within 15 min)',
  })
  @ApiOkResponse({ type: UndoStampResultDto })
  undoStamp(
    @CurrentStaff() staff: StaffWithBusiness,
    @Body() dto: UndoStampDto,
  ): Promise<UndoStampResultDto> {
    return this.stamps.undoLastStamp({
      businessId: staff.businessId,
      membershipId: dto.membershipId,
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
    });
  }

  @Post('redemptions/redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a reward voucher as handed over (by id or code)' })
  @ApiOkResponse({ type: RedeemResultDto })
  redeem(
    @CurrentStaff() staff: StaffWithBusiness,
    @Body() dto: RedeemRequestDto,
  ): Promise<RedeemResultDto> {
    return this.redemptions.redeem({
      businessId: staff.businessId,
      redemptionId: dto.redemptionId,
      code: dto.code,
      redeemerType: StampIssuerType.STAFF,
      staffId: staff.id,
    });
  }
}
