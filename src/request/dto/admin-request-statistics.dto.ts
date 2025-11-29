import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class AdminRequestStatisticsQueryDto {
  @ApiProperty({
    description: 'Start date for the period (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  from: string;

  @ApiProperty({
    description: 'End date for the period (ISO 8601 format)',
    example: '2024-12-31T23:59:59.999Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDateString()
  to: string;
}

export class RequestStatusSummaryDto {
  @ApiProperty({
    description: 'Request status',
    example: 'PENDING',
  })
  status: string;

  @ApiProperty({
    description: 'Count of requests with this status',
    example: 10,
  })
  count: number;

  @ApiProperty({
    description: 'Total cost sum for requests with this status',
    example: 1500.5,
  })
  totalCost: number;
}

export class AdminRequestStatisticsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request statistics retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of all requests in the period',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        trip_id: { type: 'string' },
        user_id: { type: 'string' },
        status: { type: 'string' },
        cost: { type: 'number', nullable: true },
        currency: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  requests: Array<{
    id: string;
    trip_id: string;
    user_id: string;
    status: string;
    cost: number | null;
    currency: string | null;
    created_at: Date;
    updated_at: Date;
  }>;

  @ApiProperty({
    description: 'Summary of requests grouped by status',
    type: [RequestStatusSummaryDto],
  })
  statusSummary: RequestStatusSummaryDto[];

  @ApiProperty({
    description: 'Total count of all requests in the period',
    example: 100,
  })
  totalCount: number;

  @ApiProperty({
    description: 'Total cost sum of all requests in the period',
    example: 50000.75,
  })
  totalCost: number;
}
