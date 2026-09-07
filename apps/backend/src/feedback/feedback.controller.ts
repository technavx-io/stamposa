import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentActor, Roles } from '../auth/decorators/auth.decorators';
import { AuthActor } from '../auth/auth.types';
import { FeedbackService } from './feedback.service';
import { SubmitFeedbackDto } from './dto/feedback.dto';

/**
 * A single feedback inbox shared by all three tenant roles. The author's
 * identity (merchant / staff / customer) is taken from the token, so the same
 * endpoint serves every portal and the body can never spoof who sent it.
 */
@ApiTags('Feedback')
@ApiBearerAuth()
@Roles('MERCHANT', 'STAFF', 'CUSTOMER')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send product feedback (merchant, staff or customer)' })
  submit(
    @CurrentActor() actor: AuthActor,
    @Body() dto: SubmitFeedbackDto,
    @Req() req: Request,
  ): Promise<{ id: string }> {
    return this.feedback.submit(actor, dto, {
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }
}
