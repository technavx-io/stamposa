import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Thin, typed facade over ioredis for the patterns this app uses:
 * OTP codes, refresh-token sessions, rate limiting and short guards.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  get raw(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setWithTtl(key: string, value: string, ttlSec: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSec);
  }

  /** Set only if absent. Returns true when the key was set. */
  async setIfAbsent(key: string, value: string, ttlSec: number): Promise<boolean> {
    const res = await this.client.set(key, value, 'EX', ttlSec, 'NX');
    return res === 'OK';
  }

  /** Overwrite a value while preserving its remaining TTL. */
  async setKeepTtl(key: string, value: string): Promise<void> {
    await this.client.set(key, value, 'KEEPTTL');
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /** Increment a counter, applying the TTL only on first increment. */
  async incrementWithWindow(key: string, windowSec: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, windowSec);
    return count;
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => this.client.disconnect());
  }
}
