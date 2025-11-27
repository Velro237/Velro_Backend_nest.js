import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { TripStatus } from 'generated/prisma/client';

export class GetUserTripsQueryDto {
  @ApiProperty({
    description: 'Filter by trip status or "ALL" to return all trips',
    enum: [...Object.values(TripStatus), 'ALL'],
    required: false,
    example: TripStatus.PUBLISHED,
  })
  @IsIn([...Object.values(TripStatus), 'ALL'])
  @IsOptional()
  status?: TripStatus | 'ALL';

  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

export class GetUserTripsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'User trips retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Array of user trips',
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        departure: { country: 'France', city: 'Paris' },
        destination: { country: 'USA', city: 'New York' },
        status: 'PUBLISHED',
        departure_date: '2024-02-15T10:00:00.000Z',
        departure_time: '10:00 AM',
        arrival_date: '2024-02-16T14:00:00.000Z',
        arrival_time: '02:00 PM',
        airline: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Air France',
          description: 'French airline',
        },
        ratings: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            rating: 5,
            comment: 'Great service',
            giver_id: '123e4567-e89b-12d3-a456-426614174000',
          },
        ],
        average_rating: 4.5,
        total_payment: 150.0,
        currency: 'XAF',
        createdAt: '2024-01-15T10:00:00.000Z',
      },
    ],
  })
  trips: Array<{
    id: string;
    departure: any;
    destination: any;
    status: TripStatus;
    departure_date: Date;
    departure_time: string;
    arrival_date: Date | null;
    arrival_time: string | null;
    airline: {
      id: string;
      name: string;
      description: string | null;
    };
    ratings: Array<{
      id: string;
      rating: number;
      comment: string | null;
      giver_id: string;
    }>;
    average_rating: number;
    total_payment: number;
    currency: string;
    createdAt: Date;
  }>;

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
