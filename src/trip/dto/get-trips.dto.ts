import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetTripsQueryDto {
  @ApiProperty({
    description: 'Country code to filter trips (e.g., "US", "FR")',
    example: 'US',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description: 'Page number for pagination (starts from 1)',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of trips per page',
    example: 10,
    minimum: 1,
    maximum: 50,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class TripSummaryDto {
  @ApiProperty({
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who created the trip',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;

  @ApiProperty({
    description: 'Pickup location',
    example: {
      country: 'United States',
      country_code: 'US',
      region: 'California',
      address: '123 Main St, San Francisco, CA 94105',
    },
  })
  pickup: any;

  @ApiProperty({
    description: 'Destination location',
    example: {
      country: 'France',
      country_code: 'FR',
      region: 'Île-de-France',
      address: '456 Champs-Élysées, Paris, France',
    },
  })
  destination: any;

  @ApiProperty({
    description: 'Travel date',
    example: '2024-02-15T10:00:00.000Z',
  })
  travel_date: Date;

  @ApiProperty({
    description: 'Travel time',
    example: '10:00 AM',
  })
  travel_time: string;

  @ApiProperty({
    description: 'Price per kg',
    example: 15.5,
  })
  price_per_kg: number;

  @ApiProperty({
    description: 'Trip status',
    example: 'PUBLISHED',
    enum: ['PUBLISHED', 'CANCELLED', 'COMPLETED', 'FULLY_BOOKED'],
  })
  status: string;

  @ApiProperty({
    description: 'Transport type name',
    example: 'Airplane',
  })
  transport_type_name: string;

  @ApiProperty({
    description: 'Trip creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;
}

export class GetTripsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trips retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of trips',
    type: [TripSummaryDto],
  })
  trips: TripSummaryDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
