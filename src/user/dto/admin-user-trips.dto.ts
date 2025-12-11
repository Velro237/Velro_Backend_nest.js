import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripStatus } from 'generated/prisma';

export class AdminGetTripsQueryDto {
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
    description:
      'Filter by user ID (optional - if not provided, returns all trips)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'Filter by trip status',
    enum: TripStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @ApiProperty({
    description:
      'Search by trip ID, departure city/country, or destination city/country',
    example: 'Paris',
    required: false,
  })
  @IsOptional()
  @IsString()
  searchKey?: string;

  @ApiProperty({
    description: 'Filter trips created from this date (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({
    description: 'Filter trips created until this date (ISO 8601 format)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AdminTripDto {
  @ApiProperty({
    description: 'Trip ID',
    example: 'trip_123',
  })
  id!: string;

  @ApiProperty({
    description: 'Departure information',
    example: { city: 'Paris', country: 'France' },
  })
  departure!: any;

  @ApiProperty({
    description: 'Destination information',
    example: { city: 'New York', country: 'USA' },
  })
  destination!: any;

  @ApiProperty({
    description: 'Trip status',
    enum: TripStatus,
    example: TripStatus.PUBLISHED,
  })
  status!: TripStatus;

  @ApiProperty({
    description: 'Departure date',
    example: '2024-01-15T10:00:00Z',
  })
  departure_date!: Date;

  @ApiProperty({
    description: 'Departure time',
    example: '10:00 AM',
    nullable: true,
  })
  departure_time!: string | null;

  @ApiProperty({
    description: 'Arrival date',
    example: '2024-01-16T14:00:00Z',
    nullable: true,
  })
  arrival_date!: Date | null;

  @ApiProperty({
    description: 'Arrival time',
    example: '02:00 PM',
    nullable: true,
  })
  arrival_time!: string | null;

  @ApiProperty({
    description: 'Airline information',
    nullable: true,
  })
  airline!: {
    id: string;
    name: string;
    description: string | null;
  } | null;

  @ApiProperty({
    description: 'Mode of transport information',
    nullable: true,
  })
  mode_of_transport!: {
    id: string;
    name: string;
    description: string | null;
  } | null;

  @ApiProperty({
    description: 'Trip creation date',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Total number of requests on this trip',
    example: 5,
  })
  totalRequests!: number;

  @ApiProperty({
    description:
      'Revenue from this trip in EUR (sum of confirmed request costs)',
    example: 1250.5,
  })
  revenue!: number;

  @ApiProperty({
    description: 'Available weight capacity in kg (sum of kg from trip items)',
    example: 50.5,
    nullable: true,
  })
  available_kg!: number | null;

  @ApiProperty({
    description:
      'Total booked weight in kg (sum of all request item quantities)',
    example: 25.0,
  })
  booked_kg!: number;
}

export class AdminGetTripsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trips retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'List of trips',
    type: [AdminTripDto],
  })
  trips!: AdminTripDto[];

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
