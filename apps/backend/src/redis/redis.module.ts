import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';
import { ThrottlerRedisStorage } from './throttler-redis.storage';

export { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: AppConfigService) =>
        new Redis(config.redisUrl, {
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
        }),
      inject: [AppConfigService],
    },
    RedisService,
    ThrottlerRedisStorage,
  ],
  exports: [REDIS_CLIENT, RedisService, ThrottlerRedisStorage],
})
export class RedisModule {}
