import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as safe to receive an `Idempotency-Key` header. When a
 * client sends that header, the response for the first successful call is
 * cached for 24h in Redis; any retry with the same key returns the same
 * response body/status without re-running the handler.
 *
 *   @Post('stamps')
 *   @Idempotent()
 *   addStamp(...) { ... }
 *
 * Apply this to POST/PATCH/DELETE routes where a duplicate would corrupt
 * state (stamp add, redeem, enroll, transfer, etc.). GETs need no marker.
 * A route without this marker ignores the header — pass-through.
 */
export const IDEMPOTENT_METADATA_KEY = 'stamposa:idempotent';
export const Idempotent = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IDEMPOTENT_METADATA_KEY, true);
