import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Redeem by voucher id (from a search result) or by the printed code. */
export class RedeemRequestDto {
  @ApiPropertyOptional({ description: 'Redemption id from a card/search payload' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  redemptionId?: string;

  @ApiPropertyOptional({ example: 'RX7K-9QZ2', description: 'Voucher code as shown on the customer card' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(12)
  code?: string;
}
