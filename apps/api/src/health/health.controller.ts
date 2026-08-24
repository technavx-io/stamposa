import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

class HealthDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 'up' })
  database: 'up' | 'down';

  @ApiProperty({ example: 'up' })
  redis: 'up' | 'down';

  @ApiProperty({ example: 123.45 })
  uptimeSec: number;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Liveness + dependency check' })
  @ApiOkResponse({ type: HealthDto })
  async check(): Promise<HealthDto> {
    const [database, redis] = await Promise.all([this.checkDb(), this.redis.ping()]);
    const body: HealthDto = {
      status: 'ok',
      database: database ? 'up' : 'down',
      redis: redis ? 'up' : 'down',
      uptimeSec: Math.round(process.uptime() * 100) / 100,
    };
    if (!database || !redis) {
      throw new ServiceUnavailableException({ ...body, status: 'degraded' });
    }
    return body;
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
