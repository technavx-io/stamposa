import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { QrModule } from '../qr/qr.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminMerchantsService } from './admin-merchants.service';
import { AdminTeamService } from './admin-team.service';
import { AdminTokenService } from './admin-token.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

/**
 * The platform operator's surface. Kept entirely separate from tenant
 * modules: different table, different credential family, different guard.
 */
@Module({
  imports: [JwtModule.register({}), QrModule, AuthModule],
  controllers: [AdminAuthController, AdminController],
  providers: [
    AdminAuthService,
    AdminTokenService,
    AdminDashboardService,
    AdminMerchantsService,
    AdminTeamService,
    // Registered globally so @AdminRoute() is enforced wherever it appears.
    { provide: APP_GUARD, useClass: AdminAuthGuard },
  ],
})
export class AdminModule {}
