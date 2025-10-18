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
  IsNotEmpty,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
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

  @ApiProperty({
    description: 'Landmark or notable location',
    example: 'Near Golden Gate Bridge',
    required: false,
  })
  @IsString()
  @IsOptional()
  landmark?: string;
}

// Type for the JSON structure that matches Prisma schema
export type LocationType = {
  country?: string;
  country_code?: string;
  region?: string;
  address?: string;
  lng?: number;
  lat?: number;
  landmark?: string;
};

@ValidatorConstraint({ name: 'TripDateValidation', async: false })
export class TripDateValidationConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const departureDate = object.departure_date;
    const arrivalDate = object.arrival_date;

    // Both dates must be provided
    if (!departureDate || !arrivalDate) {
      return false;
    }

    const departure = new Date(departureDate);
    const arrival = new Date(arrivalDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day

    // departure_date must be greater than or equal to today
    if (departure < today) {
      return false;
    }

    // arrival_date must be greater than departure_date
    if (arrival <= departure) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    const departureDate = object.departure_date;
    const arrivalDate = object.arrival_date;

    if (!departureDate || !arrivalDate) {
      return 'Both departure_date and arrival_date are required';
    }

    const departure = new Date(departureDate);
    const arrival = new Date(arrivalDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (departure < today) {
      return 'Departure date must be greater than or equal to today';
    }

    if (arrival <= departure) {
      return 'Arrival date must be greater than departure date';
    }

    return 'Invalid date range';
  }
}

@ValidatorConstraint({ name: 'LocationWithCountry', async: false })
export class LocationWithCountryConstraint
  implements ValidatorConstraintInterface
{
  validate(location: any, args: ValidationArguments) {
    if (!location || typeof location !== 'object') {
      return false;
    }

    // Must have country field and it must be a non-empty string
    return (
      location.country !== undefined &&
      location.country !== null &&
      typeof location.country === 'string' &&
      location.country.trim().length > 0
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be an object with at least a 'country' field`;
  }
}

export class CreateTripDto {
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
    description:
      'Destination location details (required - must include country)',
    type: 'object',
    required: ['country'],
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
  @Validate(LocationWithCountryConstraint)
  destination: LocationType;

  @ApiProperty({
    description: 'Departure location details (required - must include country)',
    type: 'object',
    required: ['country'],
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
      landmark: { type: 'string', example: 'Near Golden Gate Bridge' },
    },
  })
  @IsObject()
  @Validate(LocationWithCountryConstraint)
  departure: LocationType;

  @ApiProperty({
    description: 'Departure date',
    example: '2024-02-15T10:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  @Validate(TripDateValidationConstraint)
  departure_date: string;

  @ApiProperty({
    description: 'Departure time',
    example: '10:00 AM',
  })
  @IsString()
  departure_time: string;

  @ApiProperty({
    description: 'Arrival date (required)',
    example: '2024-02-16T14:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  @Validate(TripDateValidationConstraint)
  arrival_date: string;

  @ApiProperty({
    description: 'Arrival time (optional)',
    example: '2:00 PM',
    required: false,
  })
  @IsString()
  @IsOptional()
  arrival_time?: string;

  @ApiProperty({
    description: 'Transport type ID (optional)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  mode_of_transport_id?: string;

  @ApiProperty({
    description: 'Airline ID (required)',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsString()
  @IsUUID()
  airline_id: string;

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
    description: 'Meetup time is flexible',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  meetup_flexible?: boolean = false;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
    enum: [
      'USD',
      'EUR',
      'GBP',
      'CAD',
      'AUD',
      'JPY',
      'CHF',
      'CNY',
      'SEK',
      'NOK',
      'DKK',
      'PLN',
      'CZK',
      'HUF',
      'RON',
      'BGN',
      'HRK',
      'RUB',
      'UAH',
      'TRY',
      'ILS',
      'AED',
      'SAR',
      'EGP',
      'ZAR',
      'NGN',
      'KES',
      'GHS',
      'MAD',
      'TND',
      'DZD',
      'MXN',
      'BRL',
      'ARS',
      'CLP',
      'COP',
      'PEN',
      'UYU',
      'VES',
      'INR',
      'PKR',
      'BDT',
      'LKR',
      'NPR',
      'AFN',
      'KZT',
      'UZS',
      'KGS',
      'TJS',
      'TMT',
      'MNT',
      'KRW',
      'THB',
      'VND',
      'IDR',
      'MYR',
      'SGD',
      'PHP',
      'MMK',
      'LAK',
      'KHR',
      'BND',
      'FJD',
      'PGK',
      'SBD',
      'VUV',
      'WST',
      'TOP',
      'NZD',
    ],
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description:
      'List of trip items with their prices (at least one item required)',
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
        available_kg: {
          type: 'number',
          description: 'Available weight in kilograms for this trip item',
          example: 5.0,
        },
      },
      required: ['trip_item_id', 'price'],
    },
    example: [
      {
        trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
        price: 15.5,
        available_kg: 5.0,
      },
      {
        trip_item_id: '123e4567-e89b-12d3-a456-426614174001',
        price: 25.0,
        available_kg: 3.5,
      },
    ],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TripItemListDto)
  trip_items: TripItemListDto[];
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
      departure_date: '2024-02-15T10:00:00.000Z',
      departure_time: '10:00 AM',
      arrival_date: '2024-02-16T14:00:00.000Z',
      arrival_time: '2:00 PM',
      currency: 'USD',
      airline_id: '123e4567-e89b-12d3-a456-426614174002',
      createdAt: '2024-01-15T10:30:00.000Z',
      trip_items: [
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
          price: 15.5,
          available_kg: 5.0,
        },
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174001',
          price: 25.0,
          available_kg: 3.5,
        },
      ],
    },
  })
  trip: {
    id: string;
    user_id: string;
    departure_date: Date;
    departure_time: string;
    arrival_date?: Date;
    arrival_time?: string;
    currency: string;
    airline_id: string;
    createdAt: Date;
    trip_items?: {
      trip_item_id: string;
      price: number;
      available_kg?: number;
    }[];
  };
}
