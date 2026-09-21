import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HandoffController } from './handoff.controller';
import { HandoffService } from './handoff.service';

/**
 * Cross-device merchant handoff (desktop → phone). See handoff.service.ts
 * for the two-step token flow; TokenService is reused so JWT signing lives
 * in exactly one place.
 */
@Module({
  imports: [AuthModule],
  controllers: [HandoffController],
  providers: [HandoffService],
})
export class HandoffModule {}
