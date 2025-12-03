import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  Min,
  IsOptional,
  IsObject,
  Validate,
} from 'class-validator';
import {
  LocationType,
  LocationWithCountryConstraint,
} from '../../trip/dto/create-trip.dto';

export class CreateBoatShipmentDto {
  @ApiProperty({
    description: 'Departure port location details (required)',
    type: Object,
    example: {
      country: 'Germany',
      country_code: 'DE',
      region: 'Hamburg',
      address: 'Port of Hamburg',
      lat: 53.5511,
      lng: 9.9937,
    },
  })
  @Validate(LocationWithCountryConstraint)
  @IsObject()
  departure_port: LocationType;

  @ApiProperty({
    description: 'Arrival port location details (required)',
    type: Object,
    example: {
      country: 'Cameroon',
      country_code: 'CM',
      region: 'Douala',
      address: 'Port of Douala',
      lat: 4.0511,
      lng: 9.7042,
    },
  })
  @Validate(LocationWithCountryConstraint)
  @IsObject()
  arrival_port: LocationType;

  @ApiProperty({
    description: 'Departure date (ISO 8601)',
    example: '2024-12-10T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  departure_date: string;

  @ApiProperty({
    description: 'Estimated arrival date (ISO 8601)',
    example: '2024-12-28T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  arrival_date: string;

  @ApiProperty({
    description: 'Available capacity in cubic meters',
    example: 2.0,
    minimum: 0.1,
  })
  @IsNumber()
  @Min(0.1)
  capacity_in_cubic_meters: number;

  @ApiProperty({
    description: 'Maximum capacity in cubic meters',
    example: 70.0,
    minimum: 0.1,
  })
  @IsNumber()
  @Min(0.1)
  max_capacity_in_cubic_meters: number;

  @ApiProperty({
    description: 'Price per cubic meter',
    example: 150.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  price_per_cubic_meter: number;

  @ApiProperty({
    description: 'Currency for pricing',
    enum: ['EUR', 'USD', 'CAD', 'XAF'],
    example: 'EUR',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiPropertyOptional({
    description: 'Notes for senders (additional information about the shipment)',
    example: 'Working on cargo vessel MSC Oscar. Can take electronics, clothes, documents. Pick up until Dec 8. Will deliver to Douala or Can arrange city delivery.',
  })
  @IsString()
  @IsOptional()
  notes_for_senders?: string;
}

export class CreatedBoatShipmentDto {
  @ApiProperty({ description: 'Shipment ID', example: 'trip-uuid-123' })
  id: string;

  @ApiProperty({ description: 'Ship owner user ID', example: 'user-uuid-123' })
  ship_owner_id: string;

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

  @ApiProperty({ description: 'Available capacity in cubic meters', example: 2.0 })
  capacity_in_cubic_meters: number;

  @ApiProperty({ description: 'Maximum capacity in cubic meters', example: 70.0 })
  max_capacity_in_cubic_meters: number;

  @ApiProperty({ description: 'Price per cubic meter', example: 150.0 })
  price_per_cubic_meter: number;

  @ApiProperty({ description: 'Currency', example: 'EUR' })
  currency: string;

  @ApiProperty({ description: 'Trip status', example: 'PUBLISHED' })
  status: string;

  @ApiProperty({ description: 'Duration in days', example: 18 })
  duration_days: number;
}

export class CreateBoatShipmentResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Shipment created successfully',
  })
  message: string;

  @ApiProperty({ description: 'Created boat shipment', type: CreatedBoatShipmentDto })
  shipment: CreatedBoatShipmentDto;
}

