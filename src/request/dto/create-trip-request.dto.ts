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
    description: 'User ID making the request',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  @IsUUID()
  user_id: string;

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
    description: 'Created trip request information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174002',
      trip_id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'PENDING',
      message: 'I would like to request these items for my upcoming trip',
      created_at: '2024-01-15T10:30:00.000Z',
      request_items: [
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 2,
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
        {
          id: '123e4567-e89b-12d3-a456-426614174006',
          url: 'https://example.com/images/request-2.jpg',
          alt_text: 'Additional items',
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
    created_at: Date;
    request_items?: {
      trip_item_id: string;
      quantity: number;
      special_notes?: string;
      trip_item?: TripItemDetailsDto;
    }[];
    images?: {
      id: string;
      url: string;
      alt_text?: string;
    }[];
  };
}
