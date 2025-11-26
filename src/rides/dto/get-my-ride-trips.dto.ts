import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { TransportMode } from './create-ride-trip.dto';

export enum MyTripsFilter {
  UPCOMING = 'UPCOMING',
  PAST = 'PAST',
  ALL = 'ALL',
  CAR_RIDES = 'CAR_RIDES',
  FLIGHT_BAGGAGE = 'FLIGHT_BAGGAGE',
}

export class GetMyRideTripsDto {
  @ApiPropertyOptional({
    description: 'Filter trips',
    enum: MyTripsFilter,
    default: MyTripsFilter.UPCOMING,
    example: MyTripsFilter.UPCOMING,
  })
  @IsEnum(MyTripsFilter)
  @IsOptional()
  filter?: MyTripsFilter;

  @ApiPropertyOptional({
    description: 'Filter by transport mode (used with filter=CAR_RIDES or FLIGHT_BAGGAGE)',
    enum: TransportMode,
    example: TransportMode.CAR,
  })
  @IsEnum(TransportMode)
  @IsOptional()
  transport_mode?: TransportMode;
}

export class MyTripRouteDto {
  @ApiProperty({
    description: 'Departure location details',
    type: 'object',
    properties: {
      country: { type: 'string', example: 'Germany' },
      country_code: { type: 'string', example: 'DE' },
      region: { type: 'string', example: 'Hesse' },
      address: { type: 'string', example: 'Berliner Platz, Giessen, Germany' },
      lng: { type: 'number', example: 8.6842 },
      lat: { type: 'number', example: 50.5876 },
    },
  })
  departure_location: any;

  @ApiProperty({
    description: 'Arrival location details',
    type: 'object',
    properties: {
      country: { type: 'string', example: 'France' },
      country_code: { type: 'string', example: 'FR' },
      region: { type: 'string', example: 'Île-de-France' },
      address: { type: 'string', example: 'Gare du Nord, Paris, France' },
      lng: { type: 'number', example: 2.3553 },
      lat: { type: 'number', example: 48.8809 },
    },
  })
  arrival_location: any;
}

export class MyRideTripDto {
  @ApiProperty({ description: 'Trip ID', example: 'trip-uuid-123' })
  id: string;

  @ApiProperty({ description: 'Transport mode', enum: TransportMode, example: TransportMode.CAR })
  transport_mode: TransportMode;

  @ApiProperty({ description: 'Route information', type: MyTripRouteDto })
  route: MyTripRouteDto;

  @ApiProperty({ description: 'Departure date and time', example: '2024-12-25T10:00:00Z' })
  departure_datetime: Date;

  @ApiProperty({ description: 'Seats available', example: 4 })
  seats_available: number;

  @ApiProperty({ description: 'Base price per seat', example: 50.00 })
  base_price_per_seat: number;

  @ApiProperty({ description: 'Trip status', example: 'PUBLISHED' })
  status: string;

  @ApiProperty({ description: 'Created at', example: '2024-12-20T10:00:00Z' })
  createdAt: Date;
}

export class GetMyRideTripsResponseDto {
  @ApiProperty({ description: 'Trips', type: [MyRideTripDto] })
  trips: MyRideTripDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;
}

