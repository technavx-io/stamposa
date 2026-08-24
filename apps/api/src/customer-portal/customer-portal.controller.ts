import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Customer } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';
import { CurrentCustomer, Roles } from '../auth/decorators/auth.decorators';
import { CardDetailDto, CardDto, JoinResultDto } from '../loyalty/dto/loyalty.dto';
import { MembershipsService } from '../loyalty/memberships.service';
import { QrService } from '../qr/qr.service';

class CardQrDto {
  @ApiProperty({ description: 'PNG data URL encoding the customer code' })
  dataUrl: string;

  @ApiProperty({ example: '7F3K-9QZP' })
  code: string;
}

class JoinBusinessDto {
  @ApiProperty({ example: 'brew-and-bean', description: 'Business slug from the QR join link' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Length(2, 60)
  @Matches(/^[a-z0-9-]+$/, { message: 'Invalid business link.' })
  businessSlug: string;

  @ApiPropertyOptional({
    description: 'Marketing opt-in. Recorded with the exact wording shown at enrolment.',
  })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}

@ApiTags('Customer')
@ApiBearerAuth()
@Roles('CUSTOMER')
@Controller('customer')
export class CustomerPortalController {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly qr: QrService,
  ) {}

  @Post('memberships')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join a business loyalty program (idempotent — returns the existing card if already a member)' })
  @ApiOkResponse({ type: JoinResultDto })
  join(
    @CurrentCustomer() customer: Customer,
    @Body() dto: JoinBusinessDto,
    @Req() req: { ip?: string },
  ): Promise<JoinResultDto> {
    return this.memberships.join(customer.id, dto.businessSlug, {
      marketing: dto.marketingConsent ?? false,
      ipAddress: req.ip ?? null,
    });
  }

  @Get('cards')
  @ApiOperation({ summary: 'All loyalty cards belonging to the customer' })
  @ApiOkResponse({ type: CardDto, isArray: true })
  cards(@CurrentCustomer() customer: Customer): Promise<CardDto[]> {
    return this.memberships.cardsForCustomer(customer.id);
  }

  @Get('cards/:membershipId')
  @ApiOperation({ summary: 'One card with recent stamp activity (poll for live updates)' })
  @ApiOkResponse({ type: CardDetailDto })
  card(
    @CurrentCustomer() customer: Customer,
    @Param('membershipId') membershipId: string,
  ): Promise<CardDetailDto> {
    return this.memberships.cardDetailForCustomer(customer.id, membershipId);
  }

  @Get('cards/:membershipId/qr')
  @ApiOperation({
    summary: "The card's code as a QR image — shown at the counter for camera scanning",
  })
  @ApiOkResponse({ type: CardQrDto })
  async cardQr(
    @CurrentCustomer() customer: Customer,
    @Param('membershipId') membershipId: string,
  ): Promise<CardQrDto> {
    const code = await this.memberships.codeForCustomerCard(customer.id, membershipId);
    return { dataUrl: await this.qr.toDataUrl(code, 360), code };
  }
}
