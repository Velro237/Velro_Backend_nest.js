import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAlertsQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Number of alerts per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({
    description: 'Search key to filter alerts by departure or destination',
    example: 'New York',
    required: false,
  })
  @IsString()
  @IsOptional()
  searchKey?: string;
}

export class AlertSummaryDto {
  @ApiProperty({
    description: 'Alert ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who created the alert',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  user_id: string;

  @ApiProperty({
    description: 'Departure location',
    example: 'New York',
  })
  depature: string;

  @ApiProperty({
    description: 'Destination location',
    example: 'Los Angeles',
  })
  destination: string;

  @ApiProperty({
    description: 'Whether notifications are enabled',
    example: true,
  })
  notificaction: boolean;

  @ApiProperty({
    description: 'Start date for the alert',
    example: '2024-01-15T00:00:00.000Z',
    nullable: true,
  })
  form_date: Date | null;

  @ApiProperty({
    description: 'End date for the alert',
    example: '2024-01-20T00:00:00.000Z',
    nullable: true,
  })
  to_date: Date | null;

  @ApiProperty({
    description: 'Alert creation date',
    example: '2024-01-10T10:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Alert last update date',
    example: '2024-01-10T10:00:00.000Z',
  })
  updated_at: Date;
}

export class GetAlertsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Alerts retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of alerts',
    type: [AlertSummaryDto],
  })
  alerts: AlertSummaryDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
