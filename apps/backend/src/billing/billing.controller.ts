import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Business, Merchant } from '@prisma/client';
import { AuditActorType, PlatformAdmin } from '@prisma/client';
import { Public, CurrentMerchant, Roles } from '../auth/decorators/auth.decorators';
import {
  AdminRoute,
  CurrentAdmin,
  RequestContext,
  RequireCapability,
} from '../admin/decorators/admin.decorators';
import { AuditService } from '../audit/audit.service';
import { requireBusiness } from '../businesses/business.util';
import { ALL_PLANS } from './plans';
import {
  CheckoutRequestDto,
  CheckoutResponseDto,
  PlanDto,
  SubscriptionStateDto,
  toPlanDto,
} from './dto/subscription.dto';
import {
  CreatePromoCodeDto,
  PromoCodeDto,
  RedeemRequestDto,
  SetPromoActiveDto,
} from './dto/promo.dto';
import { DodoWebhookEvent, SubscriptionService } from './subscription.service';
import { DodoService } from './dodo.service';
import { PromoService } from './promo.service';

type MerchantWithBusiness = Merchant & { business: Business | null };

/** The public pricing catalog — powers the marketing pricing page. */
@ApiTags('Public')
@Controller('public/plans')
export class PublicPlansController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'All subscription plans with prices, limits and features' })
  @ApiOkResponse({ type: PlanDto, isArray: true })
  list(): PlanDto[] {
    return ALL_PLANS.map(toPlanDto);
  }
}

/** The signed-in merchant's own subscription state and checkout. */
@ApiTags('Merchant · Billing')
@ApiBearerAuth()
@Roles('MERCHANT')
@Controller('merchant/subscription')
export class MerchantSubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly promo: PromoService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current plan, trial state and what the tenant is entitled to' })
  @ApiOkResponse({ type: SubscriptionStateDto })
  state(@CurrentMerchant() merchant: MerchantWithBusiness): Promise<SubscriptionStateDto> {
    return this.subscriptions.stateFor(requireBusiness(merchant.business).id);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Start a hosted checkout for a paid plan; returns the redirect URL' })
  @ApiOkResponse({ type: CheckoutResponseDto })
  checkout(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Body() body: CheckoutRequestDto,
  ): Promise<CheckoutResponseDto> {
    const business = requireBusiness(merchant.business);
    if (!merchant.email) {
      throw new BadRequestException('Add an email to your account before subscribing.');
    }
    return this.subscriptions.beginCheckout(business.id, body.tier, body.interval, {
      email: merchant.email,
      name: business.name,
    });
  }

  @Post('cancel')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancel the paid plan at the end of the current period' })
  async cancel(@CurrentMerchant() merchant: MerchantWithBusiness): Promise<void> {
    await this.subscriptions.cancel(requireBusiness(merchant.business).id);
  }

  @Post('redeem')
  @ApiOperation({ summary: 'Redeem a promo code for a free plan period' })
  @ApiOkResponse({ type: SubscriptionStateDto })
  redeem(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Body() body: RedeemRequestDto,
  ): Promise<SubscriptionStateDto> {
    return this.promo.redeem(
      requireBusiness(merchant.business).id,
      body.code,
      this.subscriptions.billingEnabled,
    );
  }
}

/** Promo-code management for platform operators. */
@ApiTags('Admin · Billing')
@ApiBearerAuth()
@AdminRoute()
@RequireCapability('promos.manage')
@Controller('admin/promo-codes')
export class PromoAdminController {
  constructor(
    private readonly promo: PromoService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List promo codes with redemption counts' })
  @ApiOkResponse({ type: PromoCodeDto, isArray: true })
  async list(): Promise<PromoCodeDto[]> {
    return (await this.promo.list()).map(PromoCodeDto.from);
  }

  @Post()
  @ApiOperation({ summary: 'Create a promo code' })
  @ApiOkResponse({ type: PromoCodeDto })
  async create(
    @CurrentAdmin() admin: PlatformAdmin,
    @RequestContext() meta: { ipAddress: string | null; userAgent: string | null },
    @Body() dto: CreatePromoCodeDto,
  ): Promise<PromoCodeDto> {
    const created = await this.promo.create({
      code: dto.code,
      tier: dto.tier,
      freeMonths: dto.freeMonths,
      maxRedemptions: dto.maxRedemptions,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    // Bug #N1 (admin audit gap): every promo-code mutation is a
    // billing-affecting action performed by a platform operator and MUST leave
    // an audit trail. Mirrors the shape used elsewhere in AdminController
    // (customer.looked_up, merchant.suspended, …).
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: 'promo.created',
      targetType: 'promo_code',
      targetId: created.id,
      targetLabel: created.code,
      metadata: {
        tier: created.tier,
        freeMonths: created.freeMonths,
        maxRedemptions: created.maxRedemptions,
        expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return PromoCodeDto.from(created);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Enable or disable a promo code' })
  @ApiOkResponse({ type: PromoCodeDto })
  async setActive(
    @CurrentAdmin() admin: PlatformAdmin,
    @RequestContext() meta: { ipAddress: string | null; userAgent: string | null },
    @Param('id') id: string,
    @Body() dto: SetPromoActiveDto,
  ): Promise<PromoCodeDto> {
    const updated = await this.promo.setActive(id, dto.active);
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: dto.active ? 'promo.activated' : 'promo.deactivated',
      targetType: 'promo_code',
      targetId: updated.id,
      targetLabel: updated.code,
      metadata: { active: dto.active },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return PromoCodeDto.from(updated);
  }
}

/**
 * Receives Dodo Payments webhooks. Public (no bearer auth) — trust comes from
 * the Standard Webhooks signature over the raw body, not from a session.
 */
@ApiTags('Billing · Webhooks')
@Controller('billing/webhook')
export class DodoWebhookController {
  private readonly logger = new Logger(DodoWebhookController.name);

  constructor(
    private readonly dodo: DodoService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Dodo Payments event receiver (signature-verified)' })
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('webhook-id') id: string,
    @Headers('webhook-timestamp') timestamp: string,
    @Headers('webhook-signature') signature: string,
  ): Promise<{ received: true }> {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) throw new BadRequestException('Missing body');

    if (!this.dodo.verifyWebhook(raw, { id, timestamp, signature })) {
      // 400 (not 500) so Dodo doesn't hammer retries on a bad signature.
      throw new BadRequestException('Invalid webhook signature');
    }

    let event: DodoWebhookEvent;
    try {
      event = JSON.parse(raw) as DodoWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid JSON');
    }

    await this.subscriptions.applyWebhookEvent(event);
    return { received: true };
  }
}
