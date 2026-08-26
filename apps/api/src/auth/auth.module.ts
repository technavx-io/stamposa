import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    // Secrets are supplied per sign/verify call (access vs refresh differ).
    JwtModule.register({}),
    SmsModule,
    EmailModule,
  ],
  controllers: [AuthController],
  exports: [TokenService],
  providers: [
    AuthService,
    OtpService,
    EmailVerificationService,
    TokenService,
    // Registered here (not per-controller) so every route in the app is
    // authenticated by default; opt out explicitly with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
