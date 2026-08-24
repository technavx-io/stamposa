import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditActorType, PlatformAdmin } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/exceptions';
import { PhoneService } from '../common/phone.service';
import { formatCode } from '../common/utils/codes.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminMerchantsService } from './admin-merchants.service';
import { AdminTeamService } from './admin-team.service';
import { AdminRoute, CurrentAdmin, RequestContext, RequireCapability } from './decorators/admin.decorators';
import {
  AuditQueryDto,
  CreateAdminDto,
  CustomerEraseDto,
  CustomerLookupDto,
  ImpersonateDto,
  MerchantListQueryDto,
  MerchantNotesDto,
  SuspendMerchantDto,
  UpdateAdminDto,
} from './dto/admin-requests.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

interface Meta {
  ipAddress: string | null;
  userAgent: string | null;
}

@ApiTags('Admin · Panel')
@ApiBearerAuth()
@AdminRoute()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly merchants: AdminMerchantsService,
    private readonly team: AdminTeamService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly phones: PhoneService,
  ) {}

  // ── Dashboard ─────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Attention queue, platform stats and recent activity' })
  overview() {
    return this.dashboard.overview();
  }

  // ── Merchants ─────────────────────────────────────────────────────────

  @Get('merchants')
  @RequireCapability('merchants.read')
  @ApiOperation({ summary: 'List and filter every tenant' })
  listMerchants(@Query() query: MerchantListQueryDto) {
    return this.merchants.list({
      filter: query.filter ?? 'all',
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('merchants/:id')
  @RequireCapability('merchants.read')
  @ApiOperation({ summary: 'Full tenant detail: health, programme, staff, activity' })
  merchantDetail(@Param('id') id: string) {
    return this.merchants.detail(id);
  }

  @Get('merchants/:id/customers')
  @RequireCapability('merchants.read')
  @ApiOperation({ summary: 'Tenant customer list — codes and counts, no contact details' })
  merchantCustomers(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.merchants.customers(id, query.page, query.limit);
  }

  @Get('merchants/:id/audit')
  @RequireCapability('audit.read')
  @ApiOperation({ summary: 'Everything ever done to this tenant' })
  merchantAudit(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.audit.list({ businessId: id, page: query.page, limit: query.limit });
  }

  @Post('merchants/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequireCapability('merchants.suspend')
  @ApiOperation({ summary: 'Suspend a tenant — blocks logins and stamping immediately' })
  async suspend(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id') id: string,
    @Body() dto: SuspendMerchantDto,
    @RequestContext() meta: Meta,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!business) throw notFound('MERCHANT_NOT_FOUND', 'Merchant not found.');
    // Typed confirmation: the operator must retype the business name.
    if (dto.confirmName.trim().toLowerCase() !== business.name.trim().toLowerCase()) {
      throw badRequest(
        'CONFIRMATION_MISMATCH',
        `Type the business name exactly — "${business.name}" — to confirm.`,
      );
    }
    return this.merchants.suspend(admin, id, dto.reason, meta);
  }

  @Post('merchants/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequireCapability('merchants.suspend')
  @ApiOperation({ summary: 'Lift a suspension' })
  reactivate(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id') id: string,
    @RequestContext() meta: Meta,
  ) {
    return this.merchants.reactivate(admin, id, meta);
  }

  @Patch('merchants/:id/notes')
  @RequireCapability('merchants.write')
  @ApiOperation({ summary: 'Operator-only notes on a tenant' })
  notes(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id') id: string,
    @Body() dto: MerchantNotesDto,
    @RequestContext() meta: Meta,
  ) {
    return this.merchants.updateNotes(admin, id, dto.notes, meta);
  }

  @Post('merchants/:id/impersonate')
  @HttpCode(HttpStatus.OK)
  @RequireCapability('merchants.impersonate')
  @ApiOperation({ summary: 'Open a 30-minute merchant session for support. Always logged.' })
  impersonate(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id') id: string,
    @Body() dto: ImpersonateDto,
    @RequestContext() meta: Meta,
  ) {
    return this.merchants.impersonate(admin, id, dto.reason, meta);
  }

  @Post('impersonation/:sessionId/end')
  @HttpCode(HttpStatus.OK)
  @RequireCapability('merchants.impersonate')
  @ApiOperation({ summary: 'Close an impersonation session early' })
  endImpersonation(@CurrentAdmin() admin: PlatformAdmin, @Param('sessionId') sessionId: string) {
    return this.merchants.endImpersonation(admin, sessionId);
  }

  // ── Customer lookup (privacy operations) ──────────────────────────────

  @Post('customers/lookup')
  @HttpCode(HttpStatus.OK)
  @RequireCapability('customers.lookup')
  @ApiOperation({
    summary: 'Find one customer by exact phone. Reason mandatory; always audit-logged.',
  })
  async lookupCustomer(
    @CurrentAdmin() admin: PlatformAdmin,
    @Body() dto: CustomerLookupDto,
    @RequestContext() meta: Meta,
  ) {
    const phone = this.phones.normalize(dto.phone);
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
      include: {
        memberships: {
          include: { business: { select: { id: true, name: true } }, campaign: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Log the attempt whether or not it matched — the reason for looking is
    // what matters for a privacy audit, not the outcome.
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: 'customer.looked_up',
      targetType: 'customer',
      targetId: customer?.id ?? null,
      targetLabel: this.phones.mask(phone),
      reason: dto.reason,
      metadata: { found: customer !== null },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (!customer) {
      return { found: false, customer: null };
    }
    return {
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        erasedAt: customer.erasedAt,
        joinedAt: customer.createdAt,
        memberships: customer.memberships.map((m) => ({
          id: m.id,
          code: formatCode(m.code),
          businessId: m.business.id,
          businessName: m.business.name,
          campaignName: m.campaign.name,
          totalStamps: m.totalStamps,
          completedCount: m.completedCount,
          joinedAt: m.createdAt,
        })),
      },
    };
  }

  @Post('customers/:id/erase')
  @HttpCode(HttpStatus.OK)
  @RequireCapability('customers.erase')
  @ApiOperation({
    summary:
      'DPDP/GDPR erasure: anonymise the customer everywhere, revoke their sessions, keep only opaque ledger rows. Irreversible.',
  })
  async eraseCustomer(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id') customerId: string,
    @Body() dto: CustomerEraseDto,
    @RequestContext() meta: Meta,
  ) {
    if (dto.confirm !== 'ERASE') {
      throw badRequest('CONFIRMATION_MISMATCH', 'Type ERASE to confirm.');
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { memberships: { select: { id: true } } },
    });
    if (!customer) throw notFound('CUSTOMER_NOT_FOUND', 'Customer not found.');
    if (customer.erasedAt) {
      throw conflict('ALREADY_ERASED', 'This customer was already erased.');
    }
    const maskedPhone = this.phones.mask(customer.phone);

    await this.prisma.$transaction([
      // Identity: phone becomes an opaque unique sentinel, so the real
      // number is freed for a future fresh registration.
      this.prisma.customer.update({
        where: { id: customer.id },
        data: { phone: `erased:${customer.id}`, name: null, erasedAt: new Date() },
      }),
      // Merchant-held notes about the person are personal data too.
      this.prisma.customerMembership.updateMany({
        where: { customerId: customer.id },
        data: {
          notes: null,
          tags: [],
          blockedAt: new Date(),
          blockedReason: 'Customer data erased (privacy request)',
        },
      }),
      // Consent decisions stay (they are the legal record) minus the IP.
      this.prisma.consent.updateMany({
        where: { customerId: customer.id },
        data: { ipAddress: null },
      }),
    ]);

    // Kill every live session for this customer.
    const keys = await this.redis.raw.keys(`sess:CUSTOMER:${customer.id}:*`);
    await this.redis.delete(...keys);

    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: 'customer.erased',
      targetType: 'customer',
      targetId: customer.id,
      targetLabel: maskedPhone,
      reason: dto.reason,
      metadata: { memberships: customer.memberships.length, sessionsRevoked: keys.length },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { erased: true, memberships: customer.memberships.length };
  }

  // ── Audit log ─────────────────────────────────────────────────────────

  @Get('audit')
  @RequireCapability('audit.read')
  @ApiOperation({ summary: 'The platform activity trail. Read-only, always.' })
  auditLog(@Query() query: AuditQueryDto) {
    return this.audit.list({
      adminId: query.adminId,
      businessId: query.businessId,
      action: query.action,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('audit/actions')
  @RequireCapability('audit.read')
  @ApiOperation({ summary: 'Distinct action types, for the filter dropdown' })
  auditActions() {
    return this.audit.actionTypes();
  }

  // ── Platform team ─────────────────────────────────────────────────────

  @Get('team')
  @RequireCapability('team.manage')
  @ApiOperation({ summary: 'The platform operator’s own staff' })
  listTeam() {
    return this.team.list();
  }

  @Post('team')
  @RequireCapability('team.manage')
  @ApiOperation({ summary: 'Add a colleague; returns a one-time temporary password' })
  createTeamMember(
    @CurrentAdmin() admin: PlatformAdmin,
    @Body() dto: CreateAdminDto,
    @RequestContext() meta: Meta,
  ) {
    return this.team.create(admin, dto, meta);
  }

  @Patch('team/:id')
  @RequireCapability('team.manage')
  @ApiOperation({ summary: 'Rename, change role, or activate/deactivate' })
  updateTeamMember(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
    @RequestContext() meta: Meta,
  ) {
    return this.team.update(admin, id, dto, meta);
  }

  @Post('team/:id/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @RequireCapability('team.manage')
  @ApiOperation({ summary: 'Sign this admin out of every device' })
  revokeSessions(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id') id: string,
    @RequestContext() meta: Meta,
  ) {
    return this.team.revokeSessions(admin, id, meta);
  }

  // ── Health ────────────────────────────────────────────────────────────

  @Get('health')
  @RequireCapability('platform.read')
  @ApiOperation({ summary: 'Dependency status and platform counters' })
  async health() {
    const [dbOk, redisOk, counts] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`.then(() => true)
        .catch(() => false),
      this.redis.ping(),
      this.prisma.$transaction([
        this.prisma.business.count(),
        this.prisma.customer.count(),
        this.prisma.stamp.count(),
        this.prisma.redemption.count(),
        this.prisma.auditLog.count(),
      ]),
    ]);

    return {
      services: [
        { name: 'API', status: 'up' as const, detail: `uptime ${Math.round(process.uptime())}s` },
        {
          name: 'PostgreSQL',
          status: dbOk ? ('up' as const) : ('down' as const),
          detail: dbOk ? 'Responding to queries' : 'Not responding',
        },
        {
          name: 'Redis',
          status: redisOk ? ('up' as const) : ('down' as const),
          detail: redisOk ? 'Sessions and rate limits healthy' : 'Sign-in codes affected',
        },
      ],
      counters: {
        businesses: counts[0],
        customers: counts[1],
        stamps: counts[2],
        redemptions: counts[3],
        auditEntries: counts[4],
      },
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
