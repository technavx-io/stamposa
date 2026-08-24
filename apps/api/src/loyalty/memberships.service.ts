import { Injectable } from '@nestjs/common';
import { AuditActorType, CampaignStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound } from '../common/exceptions';
import { PaginatedDto } from '../common/dto/pagination.dto';
import {
  formatCode,
  generateCode,
  normalizeCodeInput,
} from '../common/utils/codes.util';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CardDetailDto,
  CardDto,
  EnrollResultDto,
  JoinResultDto,
  MembershipDetailDto,
  MembershipListItemDto,
  StampDto,
} from './dto/loyalty.dto';
import {
  PENDING_REDEMPTIONS_INCLUDE,
  toCardDetailDto,
  toCardDto,
  toMembershipDetailDto,
  toMembershipListItemDto,
  toStampDto,
} from './loyalty.presenters';

const CODE_CREATE_ATTEMPTS = 5;
const RECENT_STAMPS_ON_CARD = 15;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  // ── Customer surface ──────────────────────────────────────────────────

  /**
   * Enrols a customer in a business's active campaign (idempotent).
   * `consent` records the marketing opt-in alongside the exact wording the
   * customer saw — the consent ledger is what makes it defensible later.
   */
  async join(
    customerId: string,
    businessSlug: string,
    consent?: { marketing: boolean; ipAddress?: string | null },
  ): Promise<JoinResultDto> {
    const business = await this.prisma.business.findUnique({
      where: { slug: businessSlug },
      include: {
        campaigns: {
          where: { status: CampaignStatus.ACTIVE },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!business) throw notFound('BUSINESS_NOT_FOUND', 'This business does not exist.');
    const campaign = business.suspendedAt ? undefined : business.campaigns[0];
    if (!campaign) {
      throw conflict('JOIN_UNAVAILABLE', 'This business is not accepting new members right now.');
    }

    const existing = await this.prisma.customerMembership.findUnique({
      where: { customerId_campaignId: { customerId, campaignId: campaign.id } },
      include: { business: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
    });
    if (existing) {
      return { card: toCardDto(existing, this.urls()), alreadyMember: true };
    }

    if (consent) {
      await this.recordConsent(customerId, business.id, business, consent);
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const membership = await this.prisma.customerMembership.create({
          data: {
            code: generateCode(),
            customerId,
            businessId: business.id,
            campaignId: campaign.id,
          },
          include: { business: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
        });
        return { card: toCardDto(membership, this.urls()), alreadyMember: false };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const target = (e.meta?.target as string[] | undefined) ?? [];
          if (target.includes('code') && attempt < CODE_CREATE_ATTEMPTS) continue;
          // Unique (customerId, campaignId) — joined concurrently; return it.
          const raced = await this.prisma.customerMembership.findUnique({
            where: { customerId_campaignId: { customerId, campaignId: campaign.id } },
            include: { business: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
          });
          if (raced) return { card: toCardDto(raced, this.urls()), alreadyMember: true };
        }
        throw e;
      }
    }
  }

  async cardsForCustomer(customerId: string): Promise<CardDto[]> {
    const memberships = await this.prisma.customerMembership.findMany({
      where: { customerId },
      include: { business: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
      orderBy: [{ lastStampAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    return memberships.map((m) => toCardDto(m, this.urls()));
  }

  /** The card's code (display form) for QR rendering — ownership-checked. */
  async codeForCustomerCard(customerId: string, membershipId: string): Promise<string> {
    const membership = await this.prisma.customerMembership.findFirst({
      where: { id: membershipId, customerId },
      select: { code: true },
    });
    if (!membership) throw notFound('CARD_NOT_FOUND', 'Card not found.');
    return formatCode(membership.code);
  }

  async cardDetailForCustomer(customerId: string, membershipId: string): Promise<CardDetailDto> {
    const membership = await this.prisma.customerMembership.findFirst({
      // Ownership check: a customer can only ever read their own card.
      where: { id: membershipId, customerId },
      include: {
        business: true,
        campaign: true,
        redemptions: PENDING_REDEMPTIONS_INCLUDE,
        stamps: {
          orderBy: { createdAt: 'desc' },
          take: RECENT_STAMPS_ON_CARD,
          include: { staff: true },
        },
      },
    });
    if (!membership) throw notFound('CARD_NOT_FOUND', 'Card not found.');
    return toCardDetailDto(membership, this.urls());
  }

  // ── Business surfaces (staff console + merchant portal) ───────────────

  /**
   * Counter enrolment: staff types the customer's phone and they're in —
   * no OTP dance at the till. The customer proves ownership of the phone
   * whenever they first log in themselves; until then the card simply
   * collects stamps. Consent is only recorded when the customer explicitly
   * agreed at the counter (channel "counter" marks it staff-attested).
   */
  async enrollAtCounter(params: {
    businessId: string;
    phone: string;
    name?: string;
    marketingConsent?: boolean;
    staffId: string;
    staffName: string;
    ipAddress?: string | null;
  }): Promise<EnrollResultDto> {
    const business = await this.prisma.business.findUnique({
      where: { id: params.businessId },
      include: {
        campaigns: {
          where: { status: CampaignStatus.ACTIVE },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    const campaign = business && !business.suspendedAt ? business.campaigns[0] : undefined;
    if (!business || !campaign) {
      throw conflict('JOIN_UNAVAILABLE', 'No live campaign to enrol customers into right now.');
    }

    let customer = await this.prisma.customer.findUnique({ where: { phone: params.phone } });
    const isNewCustomer = !customer;
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { phone: params.phone, name: params.name?.trim() || null },
      });
    } else if (!customer.name && params.name?.trim()) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { name: params.name.trim() },
      });
    }

    const include = {
      customer: true,
      campaign: true,
      redemptions: PENDING_REDEMPTIONS_INCLUDE,
    } as const;

    const existing = await this.prisma.customerMembership.findUnique({
      where: { customerId_campaignId: { customerId: customer.id, campaignId: campaign.id } },
      include,
    });
    if (existing) {
      return { card: toMembershipListItemDto(existing), alreadyMember: true, isNewCustomer };
    }

    if (params.marketingConsent) {
      await this.prisma.consent.create({
        data: {
          customerId: customer.id,
          businessId: business.id,
          granted: true,
          text: business.consentText ?? defaultConsentText(business.name),
          textVersion: business.consentTextVersion,
          channel: 'counter',
          ipAddress: params.ipAddress ?? null,
        },
      });
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const membership = await this.prisma.customerMembership.create({
          data: {
            code: generateCode(),
            customerId: customer.id,
            businessId: business.id,
            campaignId: campaign.id,
          },
          include,
        });
        await this.audit.record({
          actorType: AuditActorType.STAFF,
          actorId: params.staffId,
          actorLabel: params.staffName,
          action: 'customer.enrolled_at_counter',
          targetType: 'membership',
          targetId: membership.id,
          businessId: business.id,
          metadata: { isNewCustomer, consent: params.marketingConsent === true },
        });
        return { card: toMembershipListItemDto(membership), alreadyMember: false, isNewCustomer };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const target = (e.meta?.target as string[] | undefined) ?? [];
          if (target.includes('code') && attempt < CODE_CREATE_ATTEMPTS) continue;
          const raced = await this.prisma.customerMembership.findUnique({
            where: { customerId_campaignId: { customerId: customer.id, campaignId: campaign.id } },
            include,
          });
          if (raced) {
            return { card: toMembershipListItemDto(raced), alreadyMember: true, isNewCustomer };
          }
        }
        throw e;
      }
    }
  }

  /**
   * Counter search: matches phone digits, customer code or name — always
   * scoped to the caller's business. Empty query returns recently stamped
   * members as a convenience for busy counters.
   */
  async searchForBusiness(businessId: string, query: string, limit = 10): Promise<MembershipListItemDto[]> {
    const q = query.trim();
    let where: Prisma.CustomerMembershipWhereInput;
    if (q.length === 0) {
      where = { businessId, lastStampAt: { not: null } };
    } else {
      const filters: Prisma.CustomerMembershipWhereInput[] = [];
      const digits = q.replace(/[^\d]/g, '');
      if (digits.length >= 3) {
        filters.push({ customer: { phone: { contains: digits } } });
      }
      const code = normalizeCodeInput(q);
      if (code.length >= 3) {
        filters.push({ code: { startsWith: code } });
      }
      if (/[a-zA-Z]/.test(q)) {
        filters.push({ customer: { name: { contains: q, mode: 'insensitive' } } });
      }
      if (filters.length === 0) {
        return [];
      }
      where = { businessId, OR: filters };
    }

    const memberships = await this.prisma.customerMembership.findMany({
      where,
      include: { customer: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
      orderBy: [{ lastStampAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: limit,
    });
    return memberships.map(toMembershipListItemDto);
  }

  async listForBusiness(
    businessId: string,
    params: { search?: string; page: number; limit: number },
  ): Promise<PaginatedDto<MembershipListItemDto>> {
    const q = params.search?.trim() ?? '';
    const where: Prisma.CustomerMembershipWhereInput = { businessId };
    if (q.length > 0) {
      const filters: Prisma.CustomerMembershipWhereInput[] = [
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
      const digits = q.replace(/[^\d]/g, '');
      if (digits.length >= 3) filters.push({ customer: { phone: { contains: digits } } });
      const code = normalizeCodeInput(q);
      if (code.length >= 3) filters.push({ code: { startsWith: code } });
      where.OR = filters;
    }

    const [total, memberships] = await this.prisma.$transaction([
      this.prisma.customerMembership.count({ where }),
      this.prisma.customerMembership.findMany({
        where,
        include: { customer: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
        orderBy: [{ lastStampAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);

    return PaginatedDto.of(
      memberships.map(toMembershipListItemDto),
      total,
      params.page,
      params.limit,
    );
  }

  async detailForBusiness(businessId: string, membershipId: string): Promise<MembershipDetailDto> {
    const membership = await this.prisma.customerMembership.findFirst({
      where: { id: membershipId, businessId },
      include: { customer: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
    });
    if (!membership) throw notFound('MEMBERSHIP_NOT_FOUND', 'Customer not found.');
    return toMembershipDetailDto(membership);
  }

  async stampsForBusiness(
    businessId: string,
    membershipId: string,
    params: { page: number; limit: number },
  ): Promise<PaginatedDto<StampDto>> {
    const membership = await this.prisma.customerMembership.findFirst({
      where: { id: membershipId, businessId },
      select: { id: true },
    });
    if (!membership) throw notFound('MEMBERSHIP_NOT_FOUND', 'Customer not found.');

    const [total, stamps] = await this.prisma.$transaction([
      this.prisma.stamp.count({ where: { membershipId } }),
      this.prisma.stamp.findMany({
        where: { membershipId },
        include: { staff: true },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);

    return PaginatedDto.of(stamps.map(toStampDto), total, params.page, params.limit);
  }

  /** Appends to the consent ledger; never overwrites a previous decision. */
  private async recordConsent(
    customerId: string,
    businessId: string,
    business: { consentText: string | null; consentTextVersion: number; name: string },
    consent: { marketing: boolean; ipAddress?: string | null },
  ): Promise<void> {
    await this.prisma.consent.create({
      data: {
        customerId,
        businessId,
        granted: consent.marketing,
        text: business.consentText ?? defaultConsentText(business.name),
        textVersion: business.consentTextVersion,
        channel: 'enrol_page',
        ipAddress: consent.ipAddress ?? null,
      },
    });
  }

  private urls() {
    return { apiPublicUrl: this.config.apiPublicUrl };
  }
}

/** Fallback wording when a merchant hasn't customised their consent copy. */
export function defaultConsentText(businessName: string): string {
  return `I agree to ${businessName} contacting me with offers and updates about their loyalty programme. I can unsubscribe at any time.`;
}
