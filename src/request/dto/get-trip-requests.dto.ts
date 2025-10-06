import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TripItemImageDto,
  TripItemDetailsDto,
} from '../../shared/dto/common.dto';
import { RequestStatus } from '../../../generated/prisma/client';

export class GetTripRequestsQueryDto {
  @ApiProperty({
    description: 'Trip ID to get requests for',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  trip_id?: string;

  @ApiProperty({
    description: 'User ID to get requests for',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  user_id?: string;

  @ApiProperty({
    description: 'Request status filter',
    example: 'PENDING',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

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
    description: 'Number of requests per page',
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

export class TripRequestItemSummaryDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_item_id: string;

  @ApiProperty({
    description: 'Quantity requested',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Special notes',
    example: 'Please handle with care',
  })
  special_notes?: string;

  @ApiProperty({
    description: 'Trip item details',
    type: TripItemDetailsDto,
  })
  trip_item: TripItemDetailsDto;
}

export class TripRequestSummaryDto {
  @ApiProperty({
    description: 'Request ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  id: string;

  @ApiProperty({
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_id: string;

  @ApiProperty({
    description: 'User ID who made the request',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  user_id: string;

  @ApiProperty({
    description: 'Request status',
    example: 'PENDING',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  })
  status: string;

  @ApiProperty({
    description: 'Request message',
    example: 'I would like to request these items for my upcoming trip',
  })
  message?: string;

  @ApiProperty({
    description: 'Request creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Request last update date',
    example: '2024-01-15T10:30:00.000Z',
  })
  updated_at: Date;

  @ApiProperty({
    description: 'Trip details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      pickup: {
        country: 'United States',
        country_code: 'US',
        region: 'California',
        address: '123 Main St, San Francisco, CA 94105',
      },
      destination: {
        country: 'France',
        country_code: 'FR',
        region: 'Île-de-France',
        address: '456 Champs-Élysées, Paris, France',
      },
      departure_date: '2024-02-15T10:00:00.000Z',
      departure_time: '10:00 AM',
      currency: 'USD',
      airline_id: '123e4567-e89b-12d3-a456-426614174002',
    },
  })
  trip: {
    id: string;
    pickup: any;
    destination: any;
    departure_date: Date;
    departure_time: string;
    currency: string;
    airline_id: string;
  };

  @ApiProperty({
    description: 'User details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'user@example.com',
    },
  })
  user: {
    id: string;
    email: string;
  };

  @ApiProperty({
    description: 'Requested items',
    type: [TripRequestItemSummaryDto],
  })
  request_items: TripRequestItemSummaryDto[];

  @ApiProperty({
    description: 'Request images',
    type: [TripItemImageDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174005',
        url: 'https://example.com/images/request-1.jpg',
        alt_text: 'Items to be transported',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174006',
        url: 'https://example.com/images/request-2.jpg',
        alt_text: 'Additional items',
      },
    ],
  })
  images: TripItemImageDto[];
}

export class GetTripRequestsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip requests retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of trip requests',
    type: [TripRequestSummaryDto],
  })
  requests: TripRequestSummaryDto[];

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
