import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ExportService } from './export.service';
import { TransactionsService } from './transactions.service';

/** Merchant reporting: metrics, the ledger, and CSV exports. */
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, TransactionsService, ExportService],
  exports: [AnalyticsService, TransactionsService, ExportService],
})
export class AnalyticsModule {}
