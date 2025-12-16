import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequestStatus } from 'generated/prisma';

export class AdminGetRequestsQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    required: false,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiProperty({
    description: 'Filter by trip departure city or country',
    example: 'Paris',
    required: false,
  })
  @IsOptional()
  @IsString()
  departure?: string;

  @ApiProperty({
    description: 'Filter by trip destination city or country',
    example: 'London',
    required: false,
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiProperty({
    description: 'Filter requests created from this date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({
    description: 'Filter requests created until this date (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({
    description: 'Filter by request status',
    enum: RequestStatus,
    example: RequestStatus.CONFIRMED,
    required: false,
  })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}

export class AdminRequestItemDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_item_id!: string;

  @ApiProperty({
    description: 'Quantity requested',
    example: 2,
  })
  quantity!: number;

  @ApiProperty({
    description: 'Special notes for this item',
    example: 'Handle with care',
    required: false,
  })
  special_notes?: string | null;
}

export class AdminRequestDto {
  @ApiProperty({
    description: 'Request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Sender information (person requesting)',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      firstName: { type: 'string', example: 'John', nullable: true },
      lastName: { type: 'string', example: 'Doe', nullable: true },
    },
  })
  sender!: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };

  @ApiProperty({
    description: 'Traveler information (trip creator)',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
      firstName: { type: 'string', example: 'Jane', nullable: true },
      lastName: { type: 'string', example: 'Smith', nullable: true },
    },
  })
  traveler!: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };

  @ApiProperty({
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  trip_id!: string;

  @ApiProperty({
    description: 'Requested items',
    type: [AdminRequestItemDto],
  })
  requested_items!: AdminRequestItemDto[];

  @ApiProperty({
    description: 'Trip departure location data',
    type: Object,
    additionalProperties: true,
    example: {
      city: 'Paris',
      country: 'France',
      address: '123 Main St',
    },
  })
  trip_departure!: any;

  @ApiProperty({
    description: 'Trip destination location data',
    type: Object,
    additionalProperties: true,
    example: {
      city: 'London',
      country: 'United Kingdom',
      address: '456 High St',
    },
  })
  trip_destination!: any;

  @ApiProperty({
    description: 'Request cost in EUR',
    example: 125.5,
    required: false,
  })
  cost_eur!: number | null;

  @ApiProperty({
    description: 'Request status',
    enum: RequestStatus,
    example: RequestStatus.CONFIRMED,
  })
  status!: RequestStatus;

  @ApiProperty({
    description: 'Request creation date',
    example: '2024-01-01T00:00:00Z',
  })
  created_at!: Date;
}

export class AdminGetRequestsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Requests retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'List of requests',
    type: [AdminRequestDto],
  })
  requests!: AdminRequestDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 20 },
      total: { type: 'number', example: 100 },
      totalPages: { type: 'number', example: 5 },
      hasNext: { type: 'boolean', example: true },
      hasPrev: { type: 'boolean', example: false },
    },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
