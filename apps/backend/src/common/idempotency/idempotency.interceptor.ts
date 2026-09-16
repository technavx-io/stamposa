import { createHash } from 'crypto';
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type Redis from 'ioredis';
import { Observable, of, tap } from 'rxjs';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { IDEMPOTENT_METADATA_KEY } from './idempotent.decorator';

/**
 * Global idempotency layer.
 *
 * When a route is marked @Idempotent() and the request carries a valid
 * `Idempotency-Key` header, this interceptor:
 *
 *   1. Fingerprints (method, path, actor, body-hash) and reads Redis at
 *      `idem:<key>`.
 *   2. If a completed record exists with the same fingerprint → replays
 *      the cached response (same status + body). If the fingerprint
 *      differs → 409 (client bug: same key, different request).
 *   3. If nothing exists → takes a short-lived lock, runs the handler,
 *      and caches the response for 24h.
 *   4. If a lock exists (concurrent duplicate in flight) → 409.
 *
 * A route WITHOUT @Idempotent() or a request WITHOUT the header is a
 * pure pass-through — zero behavior change.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private static readonly HEADER = 'idempotency-key';
  private static readonly MAX_KEY_LEN = 128;
  private static readonly TTL_SEC = 24 * 60 * 60; // completed responses
  private static readonly LOCK_TTL_SEC = 60;      // in-flight lock

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isIdempotent) return next.handle();

    const req = context.switchToHttp().getRequest();
    const raw = req.headers[IdempotencyInterceptor.HEADER];
    if (!raw) return next.handle();
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > IdempotencyInterceptor.MAX_KEY_LEN) {
      throw new HttpException(
        { message: `Idempotency-Key must be a non-empty string ≤${IdempotencyInterceptor.MAX_KEY_LEN} chars` },
        HttpStatus.BAD_REQUEST,
      );
    }
    // Redis-safe: strip anything not URL-safe base64.
    if (!/^[A-Za-z0-9._~+/=-]+$/.test(raw)) {
      throw new HttpException(
        { message: 'Idempotency-Key contains illegal characters' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const fingerprint = this.fingerprint(req);
    const redisKey = `idem:${raw}`;

    const existing = await this.redis.get(redisKey);
    if (existing) {
      let cached: { fingerprint: string; state: 'pending' | 'done'; status?: number; body?: unknown };
      try { cached = JSON.parse(existing); } catch { cached = { fingerprint: '', state: 'done' }; }
      if (cached.fingerprint !== fingerprint) {
        throw new HttpException(
          { message: 'Idempotency-Key was already used for a different request' },
          HttpStatus.CONFLICT,
        );
      }
      if (cached.state === 'done') {
        const res = context.switchToHttp().getResponse();
        if (typeof cached.status === 'number') res.status(cached.status);
        res.setHeader('Idempotent-Replayed', 'true');
        return of(cached.body);
      }
      throw new HttpException(
        { message: 'A request with this Idempotency-Key is currently being processed' },
        HttpStatus.CONFLICT,
      );
    }

    // Take the in-flight lock. If someone else beat us to it, treat as duplicate.
    const acquired = await this.redis.set(
      redisKey,
      JSON.stringify({ fingerprint, state: 'pending' }),
      'EX',
      IdempotencyInterceptor.LOCK_TTL_SEC,
      'NX',
    );
    if (acquired !== 'OK') {
      throw new HttpException(
        { message: 'A request with this Idempotency-Key is currently being processed' },
        HttpStatus.CONFLICT,
      );
    }

    return next.handle().pipe(
      tap({
        next: async (body) => {
          const res = context.switchToHttp().getResponse();
          const record = { fingerprint, state: 'done' as const, status: res.statusCode, body };
          try {
            await this.redis.set(
              redisKey,
              JSON.stringify(record),
              'EX',
              IdempotencyInterceptor.TTL_SEC,
            );
          } catch (e) {
            // Cache write failure must not fail the request — the handler already succeeded.
            this.logger.warn(
              `Failed to cache idempotent response for key ${raw}: ${e instanceof Error ? e.message : e}`,
            );
          }
        },
        error: async () => {
          // Release the lock so the client can retry immediately.
          try { await this.redis.del(redisKey); } catch { /* ignore */ }
        },
      }),
    );
  }

  private fingerprint(req: {
    method: string;
    originalUrl?: string;
    url?: string;
    user?: Record<string, unknown>;
    body?: unknown;
  }): string {
    const url = req.originalUrl ?? req.url ?? '';
    const actor =
      (req.user?.['userId'] as string | undefined) ??
      (req.user?.['staffId'] as string | undefined) ??
      (req.user?.['customerId'] as string | undefined) ??
      (req.user?.['merchantId'] as string | undefined) ??
      '-';
    const bodyHash = createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex').slice(0, 16);
    return createHash('sha256')
      .update(`${req.method}|${url}|${actor}|${bodyHash}`)
      .digest('hex')
      .slice(0, 32);
  }
}
