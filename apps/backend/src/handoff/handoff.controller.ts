import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentActor, Public, Roles } from '../auth/decorators/auth.decorators';
import { AuthActor } from '../auth/auth.types';
import { AuthSessionDto } from '../auth/dto/auth-response.dto';
import { HandoffService } from './handoff.service';
import {
  ConsumeHandoffDto,
  CreateHandoffDto,
  CreateHandoffResponseDto,
} from './dto/handoff.dto';

/** Tighter than the default 100/min: five per minute per merchant is enough
 *  to recover from a mis-scan without letting a compromised access token spray
 *  Redis with throwaway tokens. */
const HANDOFF_CREATE_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Merchant · Handoff')
@Controller('merchant/handoff')
export class HandoffController {
  constructor(private readonly handoff: HandoffService) {}

  /**
   * Desktop calls this to obtain a QR the phone will scan. The generated URL
   * carries a random one-time token that the phone POSTs back to `/consume`.
   */
  @Post()
  @ApiBearerAuth()
  @Roles('MERCHANT')
  @Throttle(HANDOFF_CREATE_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a one-time cross-device sign-in QR (5-min TTL, single-use).',
  })
  @ApiOkResponse({ type: CreateHandoffResponseDto })
  create(
    @CurrentActor() actor: AuthActor,
    @Body() dto: CreateHandoffDto,
  ): Promise<CreateHandoffResponseDto> {
    return this.handoff.generate(actor, dto.goto);
  }

  /**
   * Phone posts the scanned token here. Public — the whole point is that the
   * phone has no session yet. Redis GETDEL makes this call idempotent and
   * safe against a token being consumed twice.
   */
  @Public()
  @Post('consume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consume a handoff token and mint a fresh merchant session (public).',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  consume(@Body() dto: ConsumeHandoffDto): Promise<AuthSessionDto> {
    return this.handoff.consume(dto.token);
  }
}
