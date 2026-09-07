import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { Broadcast } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Lock-screen notifications are short; keep the body around SMS length. */
export class CreateBroadcastDto {
  @ApiProperty({ example: 'Weekend offer', description: 'Short headline (Google notification header)' })
  @IsString()
  @Transform(trim)
  @Length(1, 60)
  title: string;

  @ApiProperty({
    example: '20% off all drinks this Saturday — show your card at the counter.',
    description: 'The message shown on the lock screen',
  })
  @IsString()
  @Transform(trim)
  @Length(1, 160)
  body: string;
}

export class BroadcastDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ enum: ['QUEUED', 'SENDING', 'SENT', 'FAILED'] })
  status: Broadcast['status'];

  @ApiProperty({ description: 'Wallet passes reachable when the send started' })
  recipientCount: number;

  @ApiProperty({ description: 'Apple devices nudged' })
  appleDevices: number;

  @ApiProperty({ description: 'Whether Google card holders were notified' })
  googleNotified: boolean;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  sentAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/** Audience + remaining monthly quota, for the compose screen. */
export class BroadcastAudienceDto {
  @ApiProperty({ description: 'Members reachable by a wallet push (added the card to a wallet)' })
  passHolders: number;

  @ApiProperty({ description: 'Apple devices among them' })
  appleDevices: number;

  @ApiProperty({ description: 'Google cards among them' })
  googleCards: number;

  @ApiProperty({ description: 'Broadcasts already sent this calendar month' })
  sentThisMonth: number;

  @ApiProperty({ description: 'Monthly allowance for the current plan (null = unlimited)', nullable: true, type: Number })
  monthlyLimit: number | null;
}

export function toBroadcastDto(b: Broadcast): BroadcastDto {
  return {
    id: b.id,
    title: b.title,
    body: b.body,
    status: b.status,
    recipientCount: b.recipientCount,
    appleDevices: b.appleDevices,
    googleNotified: b.googleNotified,
    sentAt: b.sentAt,
    createdAt: b.createdAt,
  };
}
