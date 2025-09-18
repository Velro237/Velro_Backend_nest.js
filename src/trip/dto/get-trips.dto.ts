import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetTripsQueryDto {
  @ApiProperty({
    description:
      'Country code to prioritize trips from this country (e.g., "US", "FR"). Returns all trips but puts matching countries at the top of the array. Note: Country prioritization is disabled when searchKey is provided. Search is case-insensitive.',
    example: 'US',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description:
      'Search key to filter trips by departure_date, arrival_date, delivery country name, code, or address. Search is case-insensitive.',
    example: '2024-01-15',
    required: false,
  })
  @IsOptional()
  @IsString()
  searchKey?: string;

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

export class UserInfoDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User role',
    example: 'USER',
    enum: ['USER', 'ADMIN'],
  })
  role: string;
}

export class ModeOfTransportDto {
  @ApiProperty({
    description: 'Transport type ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Transport type name',
    example: 'Airplane',
  })
  name: string;

  @ApiProperty({
    description: 'Transport type description',
    example: 'Commercial airline flights',
  })
  description: string;
}

export class TripSummaryDto {
  @ApiProperty({
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User information',
    type: UserInfoDto,
  })
  user: UserInfoDto;

  @ApiProperty({
    description: 'Departure date',
    example: '2024-02-15T10:00:00.000Z',
  })
  departure_date: Date;

  @ApiProperty({
    description: 'Departure time',
    example: '10:00 AM',
  })
  departure_time: string;

  @ApiProperty({
    description: 'Arrival date',
    example: '2024-02-16T15:00:00.000Z',
    required: false,
  })
  arrival_date?: Date;

  @ApiProperty({
    description: 'Arrival time',
    example: '3:00 PM',
    required: false,
  })
  arrival_time?: string;

  @ApiProperty({
    description: 'Mode of transport information',
    type: ModeOfTransportDto,
  })
  mode_of_transport: ModeOfTransportDto;

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
