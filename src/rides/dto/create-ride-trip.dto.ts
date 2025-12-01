import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  Min,
  IsNumber,
  IsOptional,
  IsArray,
  IsObject,
  Validate,
} from 'class-validator';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import {
  LocationType,
  LocationWithCountryConstraint,
} from '../../trip/dto/create-trip.dto';

export enum TransportMode {
  CAR = 'CAR',
  AIRPLANE = 'AIRPLANE',
}

@ValidatorConstraint({ name: 'StopLocationWithRegion', async: false })
export class StopLocationWithRegionConstraint
  implements ValidatorConstraintInterface
{
  validate(location: any, _args: ValidationArguments) {
    if (!location || typeof location !== 'object') {
      return false;
    }

    // For ride stops we accept region-based locations (e.g. "Hesse") even without country.
    return (
      location.region !== undefined &&
      location.region !== null &&
      typeof location.region === 'string' &&
      location.region.trim().length > 0
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be an object with at least a 'region' field`;
  }
}

export class RideStopLocationDto {
  @ApiProperty({
    description: 'Stop location details',
    type: Object,
  })
  @Validate(StopLocationWithRegionConstraint)
  @IsObject()
  stop_location: LocationType;

  @ApiPropertyOptional({
    description: 'Price per seat to this stop (optional, uses base price if not set)',
    example: 25.5,
  })
  @IsNumber()
  @IsOptional()
  price_per_seat_to_stop?: number;
}

export class CreateRideTripDto {
  @ApiProperty({
    description: 'Transport mode',
    enum: TransportMode,
    example: TransportMode.CAR,
  })
  @IsEnum(TransportMode)
  transport_mode: TransportMode;

  @ApiProperty({
    description: 'Departure location details (required)',
    type: Object,
  })
  @Validate(LocationWithCountryConstraint)
  @IsObject()
  departure_location: LocationType;

  @ApiProperty({
    description: 'Arrival location details (required)',
    type: Object,
  })
  @Validate(LocationWithCountryConstraint)
  @IsObject()
  arrival_location: LocationType;

  @ApiProperty({
    description: 'Departure date and time (ISO 8601)',
    example: '2024-12-25T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  departure_datetime: string;

  @ApiProperty({
    description: 'Number of seats available',
    example: 4,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  seats_available: number;

  @ApiProperty({
    description: 'Base price per seat',
    example: 50.0,
  })
  @IsNumber()
  @Min(0)
  base_price_per_seat: number;

  @ApiPropertyOptional({
    description: "Driver's message/notes about the trip",
    example: 'I might stop in Frankfurt as well. The departure point is flexible.',
  })
  @IsString()
  @IsOptional()
  driver_message?: string;

  @ApiPropertyOptional({
    description: 'Mid-stops along the journey',
    type: [RideStopLocationDto],
  })
  @IsArray()
  @IsOptional()
  stops?: RideStopLocationDto[];
}

export class CreatedRideTripDto {
  @ApiProperty({ description: 'Trip ID', example: 'trip-uuid-123' })
  id: string;

  @ApiProperty({ description: 'Driver user ID', example: 'user-uuid-123' })
  driver_id: string;

  @ApiProperty({
    description: 'Transport mode',
    enum: TransportMode,
    example: TransportMode.CAR,
  })
  transport_mode: TransportMode;

  @ApiProperty({
    description: 'Departure location details',
    type: Object,
  })
  departure_location: LocationType;

  @ApiProperty({
    description: 'Arrival location details',
    type: Object,
  })
  arrival_location: LocationType;

  @ApiProperty({
    description: 'Departure date and time',
    example: '2024-12-25T10:00:00Z',
  })
  departure_datetime: Date;

  @ApiProperty({ description: 'Number of seats available', example: 4 })
  seats_available: number;

  @ApiProperty({ description: 'Base price per seat', example: 50.0 })
  base_price_per_seat: number;

  @ApiProperty({ description: 'Trip status', example: 'PUBLISHED' })
  status: string;
}

export class CreateRideTripResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip created successfully',
  })
  message: string;

  @ApiProperty({ description: 'Created ride trip', type: CreatedRideTripDto })
  trip: CreatedRideTripDto;
}

