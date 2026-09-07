import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminFeedbackController } from './admin-feedback.controller';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

/**
 * One feedback store, two doors: tenant users (merchant/staff/customer) POST
 * to /feedback, platform admins read and triage it under /admin/feedback.
 * The global tenant and admin guards each ignore the other's routes, so both
 * controllers live here safely.
 */
@Module({
  imports: [AuditModule],
  controllers: [FeedbackController, AdminFeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
