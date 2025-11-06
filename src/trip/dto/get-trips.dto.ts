import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  TripItemImageDto,
  TripItemDetailsDto,
} from '../../shared/dto/common.dto';

export enum TripFilterEnum {
  TODAY = 'today',
  TOMORROW = 'tomorrow',
  WEEK = 'week',
  ALL = 'all',
}

export class GetTripsQueryDto {
  @ApiProperty({
    description:
      'Country code to prioritize trips from this country (e.g., "US", "FR"). Returns all trips but puts matching countries at the top of the array. Note: Country prioritization is disabled when destinations is provided. Search is case-insensitive.',
    example: 'US',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description:
      'Search to filter trips by departure city or country. Search is case-insensitive.',
    example: 'San Francisco',
    required: false,
  })
  @IsOptional()
  @IsString()
  departure?: string;

  @ApiProperty({
    description:
      'Search to filter trips by destination city or country. Search is case-insensitive.',
    example: 'France',
    required: false,
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiProperty({
    description:
      'Filter trips by departure date. Options: "today" (trips departing today), "tomorrow" (trips departing tomorrow), "week" (trips departing this week), "all" (all future trips)',
    example: 'all',
    enum: TripFilterEnum,
    required: false,
    default: 'all',
  })
  @IsOptional()
  @IsEnum(TripFilterEnum)
  filter?: TripFilterEnum = TripFilterEnum.ALL;

  @ApiProperty({
    description: 'Start date for departure date range (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  departure_date_from?: string;

  @ApiProperty({
    description: 'End date for departure date range (ISO 8601 format)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  departure_date_to?: string;

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

  @ApiProperty({
    description:
      'Filter trips by specific trip item IDs. Can be sent as: 1) Comma-separated string (recommended): "uuid1,uuid2,uuid3", or 2) Array notation: "trip_items_ids[]=uuid1&trip_items_ids[]=uuid2". Returns trips that have at least one of the specified trip items.',
    example:
      '123e4567-e89b-12d3-a456-426614174000,123e4567-e89b-12d3-a456-426614174001',
    required: false,
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) {
      // If it's already an array, filter out empty values and return
      const filtered = value
        .map((id) => (typeof id === 'string' ? id.trim() : String(id).trim()))
        .filter((id) => id !== '');
      return filtered.length > 0 ? filtered : undefined;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      // If it's a comma-separated string, split it
      const filtered = value
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== '');
      return filtered.length > 0 ? filtered : undefined;
    }
    return undefined;
  })
  @ValidateIf(
    (o) => o.trip_items_ids !== undefined && o.trip_items_ids !== null,
  )
  @IsArray()
  @IsUUID('4', { each: true })
  trip_items_ids?: string[];
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

  @ApiProperty({
    description: 'Whether the user is a freight forwarder',
    example: false,
  })
  isFreightForwarder: boolean;
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

export class TripItemPriceDto {
  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
    enum: ['XAF', 'USD', 'EUR', 'CAD'],
  })
  currency: string;

  @ApiProperty({
    description: 'Price in this currency',
    example: 15.99,
  })
  price: number;
}

export class TripItemListItemDto {
  @ApiProperty({
    description: 'Trip item ID reference',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_item_id: string;

  @ApiProperty({
    description: 'Price per kg for this item (in trip currency)',
    example: 15.99,
  })
  price: number;

  @ApiProperty({
    description: 'Available weight in kg for this item',
    example: 5.5,
    required: false,
  })
  available_kg?: number;

  @ApiProperty({
    description: 'Prices in all supported currencies',
    type: [TripItemPriceDto],
    example: [
      { currency: 'XAF', price: 9600 },
      { currency: 'USD', price: 15.99 },
      { currency: 'EUR', price: 14.5 },
      { currency: 'CAD', price: 21.5 },
    ],
  })
  prices: TripItemPriceDto[];

  @ApiProperty({
    description: 'Trip item details',
    type: TripItemDetailsDto,
  })
  trip_item: TripItemDetailsDto;
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
    required: false,
  })
  user: UserInfoDto | null;

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
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Mode of transport information',
    type: ModeOfTransportDto,
    required: false,
  })
  mode_of_transport: ModeOfTransportDto | null;

  @ApiProperty({
    description: 'Departure location (FROM)',
    example: {
      country: 'United States',
      country_code: 'US',
      region: 'California',
      address: '123 Main St, San Francisco, CA 94105',
    },
  })
  departure: any;

  @ApiProperty({
    description: 'Destination location (TO)',
    example: {
      country: 'France',
      country_code: 'FR',
      region: 'Île-de-France',
      address: '456 Champs-Élysées, Paris, France',
    },
  })
  destination: any;

  @ApiProperty({
    description: 'Departure location (FROM) - alias of departure',
    example: {
      country: 'United States',
      country_code: 'US',
      region: 'California',
      address: '123 Main St, San Francisco, CA 94105',
    },
  })
  from?: any;

  @ApiProperty({
    description: 'Destination location (TO) - alias of destination',
    example: {
      country: 'France',
      country_code: 'FR',
      region: 'Île-de-France',
      address: '456 Champs-Élysées, Paris, France',
    },
  })
  to?: any;

  @ApiProperty({
    description: 'List of trip items with pricing and availability',
    type: [TripItemListItemDto],
  })
  trip_items: TripItemListItemDto[];

  @ApiProperty({
    description: 'Trip creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description:
      'Chat information for this trip (only if user is a member of a chat associated with this trip)',
    required: false,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Paris to New York',
      createdAt: '2024-01-15T10:30:00.000Z',
    },
  })
  chat_info?: {
    id: string;
    name: string | null;
    createdAt: Date;
  } | null;
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
