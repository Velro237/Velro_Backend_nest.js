import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransportMode } from './create-ride-trip.dto';
import { LocationType } from '../../trip/dto/create-trip.dto';

export class SearchRideTripsDto {
  @ApiPropertyOptional({
    description:
      'Optional text to match in departure location (country / region / address)',
    example: 'Giessen',
  })
  @IsString()
  @IsOptional()
  from_text?: string;

  @ApiPropertyOptional({
    description:
      'Optional text to match in arrival location (country / region / address)',
    example: 'Paris',
  })
  @IsString()
  @IsOptional()
  to_text?: string;

  @ApiPropertyOptional({
    description: 'Filter by departure date (YYYY-MM-DD). If both from_date and to_date are provided, searches within date range.',
    example: '2024-12-25',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    description: 'Filter by departure date range - FROM date (YYYY-MM-DD). Use with to_date for range search.',
    example: '2024-12-25',
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
    description: 'Filter by transport mode',
    enum: TransportMode,
    example: TransportMode.CAR,
  })
  @IsEnum(TransportMode)
  @IsOptional()
  transport_mode?: TransportMode;

  @ApiPropertyOptional({
    description: 'Minimum number of seats needed (filters trips with at least this many seats available)',
    example: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  seats_needed?: number;
}

export class DriverInfoDto {
  @ApiProperty({ description: 'Driver user ID', example: 'user-uuid-123' })
  id: string;

  @ApiProperty({ description: 'Driver name', example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({ description: 'Driver profile picture URL', example: 'https://example.com/picture.jpg' })
  picture?: string;

  @ApiPropertyOptional({ description: 'Whether driver is KYC verified', example: true })
  is_kyc_verified?: boolean;

  @ApiPropertyOptional({ description: 'Average rating (1-5)', example: 4.9 })
  average_rating?: number;

  @ApiPropertyOptional({ description: 'Total number of trips', example: 156 })
  total_trips?: number;
}
export class StopInfoDto {
  @ApiProperty({ description: 'Stop location information', type: Object })
  stop_location: LocationType;

  @ApiPropertyOptional({
    description: 'Price per seat to this stop',
    example: 25.5,
  })
  price_per_seat_to_stop?: number;
}

export class RouteInfoDto {
  @ApiProperty({ description: 'Departure location', type: Object })
  departure_location: LocationType;

  @ApiProperty({ description: 'Arrival location', type: Object })
  arrival_location: LocationType;

  @ApiProperty({
    description: 'Mid-stops along the route',
    type: [StopInfoDto],
  })
  stops: StopInfoDto[];
}

export class RideTripSearchResultDto {
  @ApiProperty({ description: 'Trip ID', example: 'trip-uuid-123' })
  id: string;

  @ApiProperty({ description: 'Driver information', type: DriverInfoDto })
  driver: DriverInfoDto;

  @ApiProperty({ description: 'Transport mode', enum: TransportMode, example: TransportMode.CAR })
  transport_mode: TransportMode;

  @ApiProperty({ description: 'Route information', type: RouteInfoDto })
  route: RouteInfoDto;

  @ApiProperty({ description: 'Departure date and time', example: '2024-12-25T10:00:00Z' })
  departure_datetime: Date;

  @ApiProperty({ description: 'Seats available', example: 4 })
  seats_available: number;

  @ApiProperty({ description: 'Price per seat for this segment', example: 50.00 })
  segment_price: number;

  @ApiProperty({ description: 'Trip status', example: 'PUBLISHED' })
  status: string;
}

export class SearchRideTripsResponseDto {
  @ApiProperty({ description: 'Search results', type: [RideTripSearchResultDto] })
  trips: RideTripSearchResultDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;
}

