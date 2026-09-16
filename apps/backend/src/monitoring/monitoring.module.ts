import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { CertExpiryService } from './cert-expiry.service';

/**
 * Operational monitoring that lives inside the API process:
 *   - CertExpiryService — daily TLS + wallet-cert expiry check → email alert.
 *
 * Sentry init is separate (see monitoring/instrument.ts) — it must run
 * before the Nest app boots, so it cannot be a Nest provider.
 */
@Module({
  imports: [EmailModule],
  providers: [CertExpiryService],
  exports: [CertExpiryService],
})
export class MonitoringModule {}
