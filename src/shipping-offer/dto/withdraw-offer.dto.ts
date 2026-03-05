import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class WithdrawOfferDto {
  @ApiPropertyOptional({ description: 'Reason for withdrawal' })
  @IsString()
  @IsOptional()
  reason?: string;
}
