import { Injectable } from '@nestjs/common';
import { Campaign, CampaignStatus } from '@prisma/client';
import { conflict, notFound } from '../common/exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignDto, CreateCampaignDto, toCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateCampaignDto): Promise<CampaignDto> {
    // Phase 1 product rule: one live campaign per business. The schema
    // supports many, so lifting this later is a one-line change.
    const existing = await this.prisma.campaign.count({
      where: { businessId, status: { not: CampaignStatus.ARCHIVED } },
    });
    if (existing > 0) {
      throw conflict(
        'CAMPAIGN_LIMIT',
        'Phase 1 supports one live campaign. Archive the current one to create another.',
      );
    }
    const campaign = await this.prisma.campaign.create({
      data: {
        businessId,
        name: dto.name,
        description: dto.description ?? null,
        stampsRequired: dto.stampsRequired,
        reward: dto.reward,
        dailyStampCap: dto.dailyStampCap ?? null,
        terms: dto.terms ?? null,
      },
    });
    return toCampaignDto(campaign, 0);
  }

  async list(businessId: string): Promise<CampaignDto[]> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { memberships: true } } },
    });
    return campaigns.map((c) => toCampaignDto(c));
  }

  async get(businessId: string, campaignId: string): Promise<CampaignDto> {
    const campaign = await this.findOwned(businessId, campaignId);
    return toCampaignDto(campaign);
  }

  async update(businessId: string, campaignId: string, dto: UpdateCampaignDto): Promise<CampaignDto> {
    await this.findOwned(businessId, campaignId);
    const campaign = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.stampsRequired !== undefined ? { stampsRequired: dto.stampsRequired } : {}),
        ...(dto.reward !== undefined ? { reward: dto.reward } : {}),
        ...(dto.dailyStampCap !== undefined ? { dailyStampCap: dto.dailyStampCap || null } : {}),
        ...(dto.terms !== undefined ? { terms: dto.terms || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { _count: { select: { memberships: true } } },
    });
    return toCampaignDto(campaign);
  }

  /** The campaign new members join and stamps accrue against. */
  async activeCampaign(businessId: string): Promise<Campaign | null> {
    return this.prisma.campaign.findFirst({
      where: { businessId, status: CampaignStatus.ACTIVE },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Active or paused campaign for dashboards (paused still shows). */
  async currentCampaign(
    businessId: string,
  ): Promise<(Campaign & { _count: { memberships: number } }) | null> {
    return this.prisma.campaign.findFirst({
      where: { businessId, status: { not: CampaignStatus.ARCHIVED } },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { memberships: true } } },
    });
  }

  private async findOwned(
    businessId: string,
    campaignId: string,
  ): Promise<Campaign & { _count: { memberships: number } }> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, businessId },
      include: { _count: { select: { memberships: true } } },
    });
    if (!campaign) throw notFound('CAMPAIGN_NOT_FOUND', 'Campaign not found.');
    return campaign;
  }
}
