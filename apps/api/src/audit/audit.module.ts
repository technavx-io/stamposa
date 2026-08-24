import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Global: audit writes are called from many modules (admin actions today,
 * merchant/staff sensitive actions next) and should never require an import
 * dance to reach.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
