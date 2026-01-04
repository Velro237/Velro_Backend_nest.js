import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryStatus } from 'generated/prisma';

export class GetAllDeliveriesQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by delivery status',
    enum: DeliveryStatus,
    example: DeliveryStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  userId?: string;
}

class DeliveryListItemDto {
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

  @ApiPropertyOptional({
    description: 'Number of products',
    example: 3,
  })
  productCount?: number;
}

export class GetAllDeliveriesResponseDto {
  @ApiPropertyOptional({
    description: 'List of deliveries',
    type: [DeliveryListItemDto],
  })
  deliveries: DeliveryListItemDto[];

  @ApiPropertyOptional({
    description: 'Total number of deliveries',
    example: 50,
  })
  total: number;

  @ApiPropertyOptional({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiPropertyOptional({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}

