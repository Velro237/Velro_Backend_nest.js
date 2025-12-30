import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';
import { DeliveryStatus } from 'generated/prisma';

export class UpdateDeliveryDto {
  @ApiPropertyOptional({
    description: 'Delivery description',
    example: 'Electronics delivery',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Expected delivery date (must be greater than today)',
    example: '2024-12-31T10:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  expected_date?: string;

  @ApiPropertyOptional({
    description: 'Reward amount (minimum 15)',
    example: 15,
    minimum: 15,
  })
  @IsNumber()
  @Min(15)
  @IsOptional()
  reward?: number;

  @ApiPropertyOptional({
    description: 'Delivery status',
    enum: DeliveryStatus,
    example: DeliveryStatus.ONGOING,
  })
  @IsOptional()
  status?: DeliveryStatus;
}

class DeliveryResponseDto {
  @ApiPropertyOptional({
    description: 'Delivery ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Total cost',
    example: 1500.0,
  })
  total_cost: number;

  @ApiPropertyOptional({
    description: 'Currency',
    example: 'EUR',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Description',
    example: 'Electronics delivery',
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Status',
    enum: DeliveryStatus,
  })
  status: DeliveryStatus;

  @ApiPropertyOptional({
    description: 'Reward',
    example: 15,
  })
  reward: number;

  @ApiPropertyOptional({
    description: 'Expected date',
    example: '2024-12-31T10:00:00.000Z',
  })
  expected_date: Date;

  @ApiPropertyOptional({
    description: 'Created at',
    example: '2024-01-01T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Updated at',
    example: '2024-01-01T10:00:00.000Z',
  })
  updatedAt: Date;
}

export class UpdateDeliveryResponseDto {
  @ApiPropertyOptional({
    description: 'Success message',
    example: 'Delivery updated successfully',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Updated delivery',
    type: DeliveryResponseDto,
  })
  delivery: DeliveryResponseDto;
}

