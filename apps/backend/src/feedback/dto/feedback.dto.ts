import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { FeedbackAuthorType, FeedbackCategory, FeedbackStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** A tenant user (merchant, staff or customer) submitting product feedback. */
export class SubmitFeedbackDto {
  @ApiProperty({ enum: FeedbackCategory, example: 'SUGGESTION' })
  @IsEnum(FeedbackCategory)
  category: FeedbackCategory;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Optional 1–5 star rating.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ minLength: 3, maxLength: 2000 })
  @IsString()
  @Length(3, 2000)
  message: string;
}

/** Admin filters for the feedback list. */
export class AdminFeedbackQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FeedbackStatus })
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @ApiPropertyOptional({ enum: FeedbackAuthorType })
  @IsOptional()
  @IsEnum(FeedbackAuthorType)
  authorType?: FeedbackAuthorType;

  @ApiPropertyOptional({ description: 'Match author label, business name or message text.' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;
}

/** Admin changing an entry's triage state. */
export class UpdateFeedbackDto {
  @ApiProperty({ enum: FeedbackStatus })
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;
}
