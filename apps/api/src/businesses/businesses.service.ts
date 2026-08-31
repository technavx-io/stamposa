import { Inject, Injectable } from '@nestjs/common';
import { Business } from '@prisma/client';
import { badRequest, conflict } from '../common/exceptions';
import { slugify, slugSuffix } from '../common/utils/codes.util';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import { FILE_STORAGE, FileStorage } from '../storage/storage.types';
import { BusinessDto, toBusinessDto } from './dto/business.dto';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business-request.dto';

const LOGO_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export class QrResult {
  joinUrl: string;
  qrDataUrl: string;
}

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly qr: QrService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async create(merchantId: string, dto: CreateBusinessDto): Promise<BusinessDto> {
    const existing = await this.prisma.business.findUnique({ where: { merchantId } });
    if (existing) {
      throw conflict('BUSINESS_EXISTS', 'You already have a business profile in Phase 1.');
    }
    const slug = await this.uniqueSlug(dto.name);
    const business = await this.prisma.business.create({
      data: {
        merchantId,
        name: dto.name,
        slug,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
      },
    });
    return this.dto(business);
  }

  async update(businessId: string, dto: UpdateBusinessDto): Promise<BusinessDto> {
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.brandColor !== undefined ? { brandColor: dto.brandColor || null } : {}),
        ...(dto.stampIcon !== undefined ? { stampIcon: dto.stampIcon } : {}),
        ...(dto.rewardIcon !== undefined ? { rewardIcon: dto.rewardIcon } : {}),
        ...(dto.category !== undefined ? { category: dto.category || null } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        // Editing the wording bumps the version so past consents stay
        // attached to the text the customer actually saw.
        ...(dto.consentText !== undefined
          ? {
              consentText: dto.consentText || null,
              consentTextVersion: { increment: 1 },
            }
          : {}),
        ...(dto.notifyDailySummary !== undefined
          ? { notifyDailySummary: dto.notifyDailySummary }
          : {}),
        ...(dto.notifyWeeklyDigest !== undefined
          ? { notifyWeeklyDigest: dto.notifyWeeklyDigest }
          : {}),
        ...(dto.notifyStaffInactive !== undefined
          ? { notifyStaffInactive: dto.notifyStaffInactive }
          : {}),
      },
    });
    return this.dto(business);
  }

  async setLogo(business: Business, file: Express.Multer.File): Promise<BusinessDto> {
    const extension = LOGO_MIME_TO_EXT[file.mimetype];
    if (!extension) {
      throw badRequest('UNSUPPORTED_FILE', 'Logo must be a PNG, JPEG or WebP image.');
    }
    const logoPath = await this.storage.save({
      buffer: file.buffer,
      directory: 'logos',
      extension,
    });
    if (business.logoPath) await this.storage.remove(business.logoPath);
    const updated = await this.prisma.business.update({
      where: { id: business.id },
      data: { logoPath },
    });
    return this.dto(updated);
  }

  async removeLogo(business: Business): Promise<BusinessDto> {
    if (business.logoPath) await this.storage.remove(business.logoPath);
    const updated = await this.prisma.business.update({
      where: { id: business.id },
      data: { logoPath: null },
    });
    return this.dto(updated);
  }

  async qrForBusiness(business: Business, size = 512): Promise<QrResult> {
    const joinUrl = this.joinUrl(business);
    const clamped = Math.min(2048, Math.max(128, size));
    return { joinUrl, qrDataUrl: await this.qr.toDataUrl(joinUrl, clamped) };
  }

  async qrPng(business: Business, size = 1024): Promise<Buffer> {
    const clamped = Math.min(2048, Math.max(128, size));
    return this.qr.toPngBuffer(this.joinUrl(business), clamped);
  }

  dto(business: Business): BusinessDto {
    return toBusinessDto(business, {
      apiPublicUrl: this.config.apiPublicUrl,
      webAppUrl: this.config.webAppUrl,
    });
  }

  private joinUrl(business: Business): string {
    return `${this.config.webAppUrl}/join/${business.slug}`;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    for (let i = 0; i < 5; i++) {
      const taken = await this.prisma.business.findUnique({ where: { slug: candidate } });
      if (!taken) return candidate;
      candidate = `${base}-${slugSuffix()}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
