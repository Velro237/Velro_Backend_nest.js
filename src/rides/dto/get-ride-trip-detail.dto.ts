import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportMode } from './create-ride-trip.dto';
import { LocationType } from '../../trip/dto/create-trip.dto';

export class DriverInfoDetailDto {
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

  @ApiPropertyOptional({ description: 'Total number of trips/ratings', example: 156 })
  total_trips?: number;
}

export class StopDetailDto {
  @ApiProperty({ description: 'Stop order (0-based)', example: 0 })
  stop_order: number;

  @ApiProperty({ description: 'Stop location', type: Object })
  stop_location: LocationType;

  @ApiPropertyOptional({ description: 'Price per seat to this stop', example: 25.50 })
  price_per_seat_to_stop?: number;
}

export class RouteDetailDto {
  @ApiProperty({ description: 'Departure location', type: Object })
  departure_location: LocationType;

  @ApiProperty({ description: 'Arrival location', type: Object })
  arrival_location: LocationType;

  @ApiProperty({ description: 'Mid-stops along the route', type: [StopDetailDto] })
  stops: StopDetailDto[];
}

export class RideTripDetailDto {
  @ApiProperty({ description: 'Trip ID', example: 'trip-uuid-123' })
  id: string;

  @ApiProperty({ description: 'Driver information', type: DriverInfoDetailDto })
  driver: DriverInfoDetailDto;

  @ApiProperty({ description: 'Transport mode', enum: TransportMode, example: TransportMode.CAR })
  transport_mode: TransportMode;

  @ApiProperty({ description: 'Route information', type: RouteDetailDto })
  route: RouteDetailDto;

  @ApiProperty({ description: 'Departure date and time', example: '2024-12-25T10:00:00Z' })
  departure_datetime: Date;

  @ApiProperty({ description: 'Seats available', example: 4 })
  seats_available: number;

  @ApiProperty({ description: 'Base price per seat', example: 50.00 })
  base_price_per_seat: number;

  @ApiPropertyOptional({ description: 'Driver\'s message/notes about the trip', example: 'I might stop in Frankfurt as well. The departure point is flexible.' })
  driver_message?: string;

  @ApiProperty({ description: 'Trip status', example: 'PUBLISHED' })
  status: string;

  @ApiProperty({ description: 'Created at', example: '2024-12-20T10:00:00Z' })
  createdAt: Date;
}

export class GetRideTripDetailResponseDto {
  @ApiProperty({ description: 'Trip details', type: RideTripDetailDto })
  trip: RideTripDetailDto;
}

