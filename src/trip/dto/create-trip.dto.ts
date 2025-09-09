import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsObject,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripItemListDto } from './trip-item-list.dto';

export class LocationDto {
  @ApiProperty({
    description: 'Country name',
    example: 'United States',
    required: false,
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'US',
    required: false,
  })
  @IsString()
  @IsOptional()
  country_code?: string;

  @ApiProperty({
    description: 'Region or state',
    example: 'California',
    required: false,
  })
  @IsString()
  @IsOptional()
  region?: string;

  @ApiProperty({
    description: 'Full address',
    example: '123 Main St, San Francisco, CA 94105',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: -122.4194,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  lng?: number;

  @ApiProperty({
    description: 'Latitude coordinate',
    example: 37.7749,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  lat?: number;
}

// Type for the JSON structure that matches Prisma schema
export type LocationType = {
  country?: string;
  country_code?: string;
  region?: string;
  address?: string;
  lng?: number;
  lat?: number;
};

export class CreateTripDto {
  @ApiProperty({
    description: 'User ID who is creating the trip',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  user_id: string;

  @ApiProperty({
    description: 'Pickup location details (required)',
    type: 'object',
    properties: {
      country: { type: 'string', example: 'United States' },
      country_code: { type: 'string', example: 'US' },
      region: { type: 'string', example: 'California' },
      address: {
        type: 'string',
        example: '123 Main St, San Francisco, CA 94105',
      },
      lng: { type: 'number', example: -122.4194 },
      lat: { type: 'number', example: 37.7749 },
    },
  })
  @IsObject()
  pickup: LocationType;

  @ApiProperty({
    description: 'Destination location details (required)',
    type: 'object',
    properties: {
      country: { type: 'string', example: 'France' },
      country_code: { type: 'string', example: 'FR' },
      region: { type: 'string', example: 'Île-de-France' },
      address: { type: 'string', example: '456 Champs-Élysées, Paris, France' },
      lng: { type: 'number', example: 2.3522 },
      lat: { type: 'number', example: 48.8566 },
    },
  })
  @IsObject()
  destination: LocationType;

  @ApiProperty({
    description: 'Travel date',
    example: '2024-02-15T10:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  travel_date: string;

  @ApiProperty({
    description: 'Travel time',
    example: '10:00 AM',
  })
  @IsString()
  travel_time: string;

  @ApiProperty({
    description: 'Transport type ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  @IsUUID()
  mode_of_transport_id: string;

  @ApiProperty({
    description: 'Maximum weight in kilograms',
    example: 25.5,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  maximum_weight_in_kg?: number;

  @ApiProperty({
    description: 'Additional notes',
    example: 'Fragile items, handle with care',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'Full suitcase only',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  fullSuitcaseOnly?: boolean = false;

  @ApiProperty({
    description: 'Price per kilogram',
    example: 15.5,
  })
  @IsNumber()
  price_per_kg: number;

  @ApiProperty({
    description: 'List of trip items with their prices',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        trip_item_id: {
          type: 'string',
          format: 'uuid',
          description: 'Trip item ID',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        price: {
          type: 'number',
          description: 'Price for this trip item',
          example: 15.5,
        },
      },
      required: ['trip_item_id', 'price'],
    },
    example: [
      {
        trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
        price: 15.5,
      },
      {
        trip_item_id: '123e4567-e89b-12d3-a456-426614174001',
        price: 25.0,
      },
    ],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripItemListDto)
  @IsOptional()
  trip_items?: TripItemListDto[];
}

export class CreateTripResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created trip information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      travel_date: '2024-02-15T10:00:00.000Z',
      travel_time: '10:00 AM',
      price_per_kg: 15.5,
      createdAt: '2024-01-15T10:30:00.000Z',
      trip_items: [
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
          price: 15.5,
        },
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174001',
          price: 25.0,
        },
      ],
    },
  })
  trip: {
    id: string;
    user_id: string;
    travel_date: Date;
    travel_time: string;
    price_per_kg: any; // Decimal from Prisma
    createdAt: Date;
    trip_items?: {
      trip_item_id: string;
      price: number;
    }[];
  };
}
