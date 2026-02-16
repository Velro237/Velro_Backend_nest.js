import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShippingOfferDto {
  @ApiProperty({ description: 'Shipping request ID' })
  @IsString()
  requestId: string;

  @ApiProperty({ description: 'Reward amount offered by traveler' })
  @IsNumber()
  rewardAmount: number;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsOptional()
  @IsDateString()
  deliverBy?: string;

  @ApiPropertyOptional({ description: 'Optional message with the offer' })
  @IsOptional()
  @IsString()
  message?: string;
}
