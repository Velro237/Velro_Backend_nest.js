import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TripItemImageDto,
  TripItemDetailsDto,
} from '../../shared/dto/common.dto';

export class TripRequestItemDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  trip_item_id: string;

  @ApiProperty({
    description: 'Quantity of this item requested',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Special notes for this item',
    example: 'Please handle with care',
    required: false,
  })
  @IsString()
  @IsOptional()
  special_notes?: string;
}

export class CreateTripRequestImageDto {
  @ApiProperty({
    description: 'Image URL',
    example: 'https://example.com/images/request-image.jpg',
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Image alt text',
    example: 'Request image showing items',
    required: false,
  })
  @IsString()
  @IsOptional()
  alt_text?: string;
}

export class CreateTripRequestDto {
  @ApiProperty({
    description: 'Trip ID to request from',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  trip_id: string;

  @ApiProperty({
    description: 'Optional message to the trip owner',
    example: 'I would like to request these items for my upcoming trip',
    required: false,
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiProperty({
    description:
      'List of trip items with quantities (required for non-full suitcase trips, ignored for full suitcase trips)',
    type: [TripRequestItemDto],
    example: [
      {
        trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 2,
        special_notes: 'Please handle with care',
      },
      {
        trip_item_id: '123e4567-e89b-12d3-a456-426614174001',
        quantity: 1,
      },
    ],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripRequestItemDto)
  @IsOptional()
  request_items?: TripRequestItemDto[];

  @ApiProperty({
    description: 'Array of images related to the request',
    type: [CreateTripRequestImageDto],
    example: [
      {
        url: 'https://example.com/images/request-1.jpg',
        alt_text: 'Items to be transported',
      },
      {
        url: 'https://example.com/images/request-2.jpg',
        alt_text: 'Additional items',
      },
    ],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTripRequestImageDto)
  @IsOptional()
  images?: CreateTripRequestImageDto[];
}

export class CreateTripRequestResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip request created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created trip request information with full trip details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174002',
      trip_id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'PENDING',
      message: 'I would like to request these items for my upcoming trip',
      cost: 31.98,
      currency: 'USD',
      created_at: '2024-01-15T10:30:00.000Z',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'requester@example.com',
        name: 'John Requester',
        picture: 'https://example.com/requester.jpg',
        role: 'USER',
        kycRecord: {
          id: 'kyc-456',
          status: 'VERIFIED',
          provider: 'DIDIT',
          rejectionReason: null,
          createdAt: '2024-01-10T10:00:00.000Z',
          updatedAt: '2024-01-10T10:00:00.000Z',
        },
      },
      trip: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174003',
        user: {
          id: '123e4567-e89b-12d3-a456-426614174003',
          email: 'tripowner@example.com',
          name: 'Trip Owner',
          picture: 'https://example.com/profile.jpg',
          role: 'USER',
          kycRecord: {
            id: 'kyc-123',
            status: 'VERIFIED',
            provider: 'DIDIT',
            rejectionReason: null,
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
        },
        departure: {
          country: 'United States',
          country_code: 'US',
          region: 'California',
          address: '123 Main St, San Francisco, CA',
        },
        destination: {
          country: 'France',
          country_code: 'FR',
          region: 'Île-de-France',
          address: '456 Champs-Élysées, Paris',
        },
        departure_date: '2024-02-15T10:00:00.000Z',
        departure_time: '10:00 AM',
        arrival_date: '2024-02-16T14:00:00.000Z',
        arrival_time: '2:00 PM',
        currency: 'USD',
        trip_items: [
          {
            trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
            price: 15.99,
            available_kg: 5.0,
            trip_item: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Electronics',
              description: 'Electronic devices and gadgets',
              image: {
                id: '123e4567-e89b-12d3-a456-426614174004',
                url: 'https://example.com/images/electronics.jpg',
                alt_text: 'Electronics image',
              },
            },
          },
        ],
      },
      request_items: [
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 2,
          price: 15.99,
          special_notes: 'Please handle with care',
          trip_item: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Electronics',
            description: 'Electronic devices and gadgets',
            image: {
              id: '123e4567-e89b-12d3-a456-426614174004',
              url: 'https://example.com/images/electronics.jpg',
              alt_text: 'Electronics image',
            },
          },
        },
      ],
      images: [
        {
          id: '123e4567-e89b-12d3-a456-426614174005',
          url: 'https://example.com/images/request-1.jpg',
          alt_text: 'Items to be transported',
        },
      ],
    },
  })
  request: {
    id: string;
    trip_id: string;
    user_id: string;
    status: string;
    message?: string;
    cost?: number;
    currency: string;
    created_at: Date;
    user: {
      id: string;
      email: string;
      name?: string;
      picture?: string;
      role: string;
      kycRecord?: {
        id: string;
        status: string;
        provider: string;
        rejectionReason?: string;
        createdAt: Date;
        updatedAt: Date;
      } | null;
    };
    trip: {
      id: string;
      user_id: string;
      user: {
        id: string;
        email: string;
        name?: string;
        picture?: string;
        role: string;
        kycRecord?: {
          id: string;
          status: string;
          provider: string;
          rejectionReason?: string;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      };
      departure?: any;
      destination?: any;
      departure_date: Date;
      departure_time: string;
      arrival_date?: Date;
      arrival_time?: string;
      currency: string;
      trip_items: {
        trip_item_id: string;
        price: number;
        available_kg?: number;
        trip_item: TripItemDetailsDto;
      }[];
    };
    request_items?: {
      trip_item_id: string;
      quantity: number;
      price: number;
      special_notes?: string;
      trip_item?: TripItemDetailsDto;
    }[];
    images?: {
      id: string;
      url: string;
      alt_text?: string;
    }[];
  };

  @ApiProperty({
    description:
      'Average response time (in seconds) for the trip owner in the associated chat. Null when insufficient data.',
    example: 42.5,
    required: false,
    nullable: true,
  })
  average_request_response_time?: number | null;
}
