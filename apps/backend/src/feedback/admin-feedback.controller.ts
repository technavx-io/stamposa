import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeedbackStatus, PlatformAdmin } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { notFound } from '../common/exceptions';
import { AdminRoute, CurrentAdmin, RequireCapability } from '../admin/decorators/admin.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { FeedbackService } from './feedback.service';
import { AdminFeedbackQueryDto, UpdateFeedbackDto } from './dto/feedback.dto';

/** The operator-facing view of tenant feedback. Read + triage only. */
@ApiTags('Admin · Feedback')
@ApiBearerAuth()
@AdminRoute()
@Controller('admin/feedback')
export class AdminFeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequireCapability('feedback.read')
  @ApiOperation({ summary: 'List and filter tenant feedback' })
  list(@Query() query: AdminFeedbackQueryDto) {
    return this.feedback.list({
      status: query.status,
      authorType: query.authorType,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('counts')
  @RequireCapability('feedback.read')
  @ApiOperation({ summary: 'Feedback counts per triage status' })
  counts() {
    return this.feedback.statusCounts();
  }

  @Patch(':id')
  @RequireCapability('feedback.manage')
  @ApiOperation({ summary: 'Move a feedback entry through triage (new/reviewed/resolved)' })
  async setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
    @CurrentAdmin() admin: PlatformAdmin,
  ) {
    const existing = await this.prisma.feedback.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('FEEDBACK_NOT_FOUND', 'That feedback no longer exists.');

    const updated = await this.feedback.setStatus(id, dto.status, admin.id);
    await this.audit.record({
      actorType: 'ADMIN',
      adminId: admin.id,
      actorLabel: admin.name,
      action: 'feedback.status_changed',
      targetType: 'feedback',
      targetId: id,
      targetLabel: updated.authorLabel,
      businessId: updated.businessId,
      metadata: { status: dto.status as FeedbackStatus },
    });
    return updated;
  }
}
