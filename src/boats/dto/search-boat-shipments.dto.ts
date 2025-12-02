import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationType } from '../../trip/dto/create-trip.dto';

export class SearchBoatShipmentsDto {
  @ApiPropertyOptional({
    description:
      'Optional text to match in departure port location (country / region / address)',
    example: 'Hamburg',
  })
  @IsString()
  @IsOptional()
  from_text?: string;

  @ApiPropertyOptional({
    description:
      'Optional text to match in arrival port location (country / region / address)',
    example: 'Douala',
  })
  @IsString()
  @IsOptional()
  to_text?: string;

  @ApiPropertyOptional({
    description: 'Filter by departure date (YYYY-MM-DD). If both from_date and to_date are provided, searches within date range.',
    example: '2024-12-10',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    description: 'Filter by departure date range - FROM date (YYYY-MM-DD). Use with to_date for range search.',
    example: '2024-12-10',
  })
  @IsDateString()
  @IsOptional()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter by departure date range - TO date (YYYY-MM-DD). Use with from_date for range search.',
    example: '2024-12-31',
  })
  @IsDateString()
  @IsOptional()
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Minimum capacity needed in cubic meters (filters shipments with at least this much capacity available)',
    example: 1.0,
    minimum: 0.1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @IsOptional()
  capacity_needed?: number;
}

export class ShipOwnerInfoDto {
  @ApiProperty({ description: 'Ship owner user ID', example: 'user-uuid-123' })
  id: string;

  @ApiProperty({ description: 'Ship owner name', example: 'Charles T.' })
  name: string;

  @ApiPropertyOptional({ description: 'Ship owner profile picture URL', example: 'https://example.com/picture.jpg' })
  picture?: string;

  @ApiPropertyOptional({ description: 'Whether ship owner is KYC verified', example: true })
  is_kyc_verified?: boolean;

  @ApiPropertyOptional({ description: 'Average rating (1-5)', example: 4.0 })
  average_rating?: number;

  @ApiPropertyOptional({ description: 'Total number of shipments', example: 25 })
  total_shipments?: number;
}

export class BoatShipmentSearchResultDto {
  @ApiProperty({ description: 'Shipment ID', example: 'trip-uuid-123' })
  id: string;

  @ApiProperty({
    description: 'Departure port location details',
    type: Object,
  })
  departure_port: LocationType;

  @ApiProperty({
    description: 'Arrival port location details',
    type: Object,
  })
  arrival_port: LocationType;

  @ApiProperty({
    description: 'Departure date',
    example: '2024-12-10T00:00:00Z',
  })
  departure_date: Date;

  @ApiProperty({
    description: 'Estimated arrival date',
    example: '2024-12-28T00:00:00Z',
  })
  arrival_date: Date;

  @ApiProperty({ description: 'Duration in days', example: 18 })
  duration_days: number;

  @ApiProperty({ description: 'Available capacity in cubic meters', example: 2.0 })
  capacity_available: number;

  @ApiProperty({ description: 'Maximum capacity in cubic meters', example: 70.0 })
  max_capacity: number;

  @ApiProperty({ description: 'Price per cubic meter', example: 150.0 })
  price_per_cubic_meter: number;

  @ApiProperty({ description: 'Currency', example: 'EUR' })
  currency: string;

  @ApiProperty({ description: 'Ship owner information', type: ShipOwnerInfoDto })
  ship_owner: ShipOwnerInfoDto;

  @ApiProperty({ description: 'Trip status', example: 'PUBLISHED' })
  status: string;
}

export class SearchBoatShipmentsResponseDto {
  @ApiProperty({
    description: 'Array of matching boat shipments',
    type: [BoatShipmentSearchResultDto],
  })
  shipments: BoatShipmentSearchResultDto[];

  @ApiProperty({ description: 'Total number of matching shipments', example: 5 })
  total: number;
}

