import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/app-config.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SharedModule } from './common/shared.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { RedisModule } from './redis/redis.module';
import { ThrottlerRedisStorage } from './redis/throttler-redis.storage';
import { StaffConsoleModule } from './staff-console/staff-console.module';
import { WalletModule } from './wallet/wallet.module';
import { StaffManagementModule } from './staff-management/staff-management.module';

@Module({
  imports: [
    // Infrastructure (all global)
    AppConfigModule,
    PrismaModule,
    RedisModule,
    SharedModule,
    AuditModule,
    ThrottlerModule.forRootAsync({
      useFactory: (storage: ThrottlerRedisStorage) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        storage,
      }),
      inject: [ThrottlerRedisStorage],
    }),
    // Features
    AuthModule,
    AdminModule,
    BusinessesModule,
    CampaignsModule,
    LoyaltyModule,
    AnalyticsModule,
    StaffManagementModule,
    StaffConsoleModule,
    WalletModule,
    CustomerPortalModule,
    DashboardModule,
    PublicModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
