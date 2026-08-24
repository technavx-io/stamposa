import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { CampaignStatus } from '@prisma/client';
import { Public } from '../auth/decorators/auth.decorators';
import { notFound } from '../common/exceptions';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { defaultConsentText } from '../loyalty/memberships.service';

class PublicCampaignDto {
  @ApiProperty({ example: 'Coffee Lovers Card' })
  name: string;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ example: 10 })
  stampsRequired: number;

  @ApiProperty({ example: '1 free coffee of your choice' })
  reward: string;

  @ApiProperty({ nullable: true, type: String })
  terms: string | null;
}

class PublicBusinessDto {
  @ApiProperty({ example: 'Brew & Bean Coffee' })
  name: string;

  @ApiProperty({ example: 'brew-and-bean' })
  slug: string;

  @ApiProperty({ nullable: true, type: String })
  logoUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  address: string | null;

  @ApiProperty({ type: PublicCampaignDto, nullable: true })
  campaign: PublicCampaignDto | null;

  @ApiProperty({ nullable: true, type: String, example: '#4F46E5' })
  brandColor: string | null;

  @ApiProperty({ description: 'Wording the customer must agree to' })
  consentText: string;

  @ApiProperty({ description: 'False when no campaign is live (join disabled)' })
  acceptingJoins: boolean;
}

/** Unauthenticated data behind the QR join page. Deliberately minimal. */
@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get('businesses/:slug')
  @ApiOperation({ summary: 'Business info shown on the customer join page' })
  @ApiOkResponse({ type: PublicBusinessDto })
  async business(@Param('slug') slug: string): Promise<PublicBusinessDto> {
    const business = await this.prisma.business.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        campaigns: {
          where: { status: CampaignStatus.ACTIVE },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!business) throw notFound('BUSINESS_NOT_FOUND', 'This business does not exist.');

    // A platform suspension hides the programme from new customers without
    // leaking that the account was suspended.
    const suspended = business.suspendedAt !== null;
    const campaign = suspended ? null : (business.campaigns[0] ?? null);
    return {
      name: business.name,
      slug: business.slug,
      logoUrl: business.logoPath ? `${this.config.apiPublicUrl}${business.logoPath}` : null,
      address: business.address,
      campaign: campaign
        ? {
            name: campaign.name,
            description: campaign.description,
            stampsRequired: campaign.stampsRequired,
            reward: campaign.reward,
            terms: campaign.terms,
          }
        : null,
      brandColor: business.brandColor,
      consentText: business.consentText ?? defaultConsentText(business.name),
      acceptingJoins: campaign !== null,
    };
  }
}
