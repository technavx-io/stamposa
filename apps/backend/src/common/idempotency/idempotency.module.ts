import { Global, Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Registers the interceptor as a provider (global) so the wiring in
 * app.module.ts can bind it via APP_INTERCEPTOR. The Reflector and
 * REDIS_CLIENT it depends on are already global.
 */
@Global()
@Module({
  providers: [IdempotencyInterceptor],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
