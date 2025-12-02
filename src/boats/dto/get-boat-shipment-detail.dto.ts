import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType } from '../../trip/dto/create-trip.dto';
import { ShipOwnerInfoDto } from './search-boat-shipments.dto';

export class GetBoatShipmentDetailResponseDto {
  @ApiProperty({ description: 'Shipment ID', example: 'trip-uuid-123' })
  id: string;

  @ApiProperty({ description: 'Ship owner information', type: ShipOwnerInfoDto })
  ship_owner: ShipOwnerInfoDto;

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

  @ApiPropertyOptional({
    description: 'Notes for senders',
    example: 'Working on cargo vessel MSC Oscar. Can take electronics, clothes, documents. Pick up until Dec 8. Will deliver to Douala or Can arrange city delivery.',
  })
  notes_for_senders?: string;

  @ApiProperty({ description: 'Trip status', example: 'PUBLISHED' })
  status: string;

  @ApiProperty({ description: 'Created at timestamp', example: '2024-12-01T10:00:00Z' })
  created_at: Date;
}

