import { Controller, Get, Header, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Business, Merchant, StampIssuerType } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentMerchant, Roles } from '../auth/decorators/auth.decorators';
import { requireBusiness } from '../businesses/business.util';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AnalyticsService, RangeKey } from './analytics.service';
import { ExportService } from './export.service';
import { TransactionsService } from './transactions.service';

class RangeQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d', '90d'], default: '30d' })
  @IsOptional()
  @IsEnum({ '7d': '7d', '30d': '30d', '90d': '90d' })
  range?: RangeKey;
}

class TransactionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Customer name, phone digits or card code' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @ApiPropertyOptional({ enum: StampIssuerType })
  @IsOptional()
  @IsEnum(StampIssuerType)
  issuerType?: StampIssuerType;

  @ApiPropertyOptional() @IsOptional() @IsString() staffId?: string;
  @ApiPropertyOptional({ example: '2026-08-01' }) @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional({ example: '2026-08-31' }) @IsOptional() @IsISO8601() to?: string;
}

type MerchantWithBusiness = Merchant & { business: Business | null };

@ApiTags('Merchant · Analytics')
@ApiBearerAuth()
@Roles('MERCHANT')
@Controller('merchant')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly transactions: TransactionsService,
    private readonly exports: ExportService,
  ) {}

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Headline metrics with change vs the previous period' })
  summary(@CurrentMerchant() merchant: MerchantWithBusiness, @Query() query: RangeQueryDto) {
    return this.analytics.summary(requireBusiness(merchant.business), query.range ?? '30d');
  }

  @Get('analytics/series')
  @ApiOperation({ summary: 'Daily stamps and joins, zero-filled, in the business timezone' })
  series(@CurrentMerchant() merchant: MerchantWithBusiness, @Query() query: RangeQueryDto) {
    return this.analytics.series(requireBusiness(merchant.business), query.range ?? '30d');
  }

  @Get('analytics/top-customers')
  @ApiOperation({ summary: 'Most loyal customers by lifetime stamps' })
  topCustomers(@CurrentMerchant() merchant: MerchantWithBusiness) {
    return this.analytics.topCustomers(requireBusiness(merchant.business).id);
  }

  @Get('analytics/staff')
  @ApiOperation({ summary: 'Stamps issued per staff member in the period' })
  staff(@CurrentMerchant() merchant: MerchantWithBusiness, @Query() query: RangeQueryDto) {
    return this.analytics.staffPerformance(requireBusiness(merchant.business), query.range ?? '30d');
  }

  // ── Ledger ────────────────────────────────────────────────────────────

  @Get('transactions')
  @ApiOperation({ summary: 'Every stamp and adjustment, newest first' })
  list(@CurrentMerchant() merchant: MerchantWithBusiness, @Query() query: TransactionQueryDto) {
    const business = requireBusiness(merchant.business);
    return this.transactions.list({
      businessId: business.id,
      search: query.search,
      issuerType: query.issuerType,
      staffId: query.staffId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(`${query.to.slice(0, 10)}T23:59:59.999Z`) : undefined,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('transactions/totals')
  @ApiOperation({ summary: 'Entry count, net stamps and adjustment count' })
  totals(@CurrentMerchant() merchant: MerchantWithBusiness, @Query() query: TransactionQueryDto) {
    const business = requireBusiness(merchant.business);
    return this.transactions.totals(
      business.id,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(`${query.to.slice(0, 10)}T23:59:59.999Z`) : undefined,
    );
  }

  // ── Exports ───────────────────────────────────────────────────────────

  @Get('export/customers.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Download the customer list. Free on every plan.' })
  async exportCustomers(@CurrentMerchant() merchant: MerchantWithBusiness) {
    const business = requireBusiness(merchant.business);
    return this.csv(await this.exports.customersCsv(business), `customers-${business.slug}`);
  }

  @Get('export/transactions.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Download the full ledger' })
  async exportTransactions(@CurrentMerchant() merchant: MerchantWithBusiness) {
    const business = requireBusiness(merchant.business);
    return this.csv(await this.exports.transactionsCsv(business), `transactions-${business.slug}`);
  }

  @Get('export/rewards.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Download every reward earned and handed over' })
  async exportRewards(@CurrentMerchant() merchant: MerchantWithBusiness) {
    const business = requireBusiness(merchant.business);
    return this.csv(await this.exports.rewardsCsv(business), `rewards-${business.slug}`);
  }

  private csv(content: string, filename: string): StreamableFile {
    const stamp = new Date().toISOString().slice(0, 10);
    return new StreamableFile(Buffer.from(content, 'utf-8'), {
      disposition: `attachment; filename="${filename}-${stamp}.csv"`,
    });
  }
}
