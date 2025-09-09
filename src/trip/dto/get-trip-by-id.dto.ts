import { ApiProperty } from '@nestjs/swagger';

export class TripItemDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_item_id: string;

  @ApiProperty({
    description: 'Price for this trip item',
    example: 15.5,
  })
  price: number;

  @ApiProperty({
    description: 'Trip item details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Electronics',
      description: 'Electronic devices and gadgets',
      image_url: 'https://example.com/images/electronics.jpg',
    },
  })
  trip_item: {
    id: string;
    name: string;
    description: string;
    image_url: string;
  };
}

export class TripDetailsDto {
  @ApiProperty({
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who created the trip',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;

  @ApiProperty({
    description: 'Pickup location details',
    example: {
      country: 'United States',
      country_code: 'US',
      region: 'California',
      address: '123 Main St, San Francisco, CA 94105',
      lng: -122.4194,
      lat: 37.7749,
    },
  })
  pickup: any;

  @ApiProperty({
    description: 'Destination location details',
    example: {
      country: 'France',
      country_code: 'FR',
      region: 'Île-de-France',
      address: '456 Champs-Élysées, Paris, France',
      lng: 2.3522,
      lat: 48.8566,
    },
  })
  destination: any;

  @ApiProperty({
    description: 'Travel date',
    example: '2024-02-15T10:00:00.000Z',
  })
  travel_date: Date;

  @ApiProperty({
    description: 'Travel time',
    example: '10:00 AM',
  })
  travel_time: string;

  @ApiProperty({
    description: 'Mode of transport ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  mode_of_transport_id: string;

  @ApiProperty({
    description: 'Maximum weight in kg',
    example: 25.5,
  })
  maximum_weight_in_kg: number;

  @ApiProperty({
    description: 'Additional notes',
    example: 'Fragile items, handle with care',
  })
  notes: string;

  @ApiProperty({
    description: 'Full suitcase only',
    example: false,
  })
  fullSuitcaseOnly: boolean;

  @ApiProperty({
    description: 'Price per kg',
    example: 15.5,
  })
  price_per_kg: number;

  @ApiProperty({
    description: 'Trip status',
    example: 'PUBLISHED',
    enum: ['PUBLISHED', 'CANCELLED', 'COMPLETED', 'FULLY_BOOKED'],
  })
  status: string;

  @ApiProperty({
    description: 'Trip creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Trip last update date',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Transport type details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Airplane',
      description: 'Commercial airline transportation',
    },
  })
  transport_type: {
    id: string;
    name: string;
    description: string;
  };

  @ApiProperty({
    description: 'Trip items with prices',
    type: [TripItemDto],
  })
  trip_items: TripItemDto[];
}

export class GetTripByIdResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Trip details',
    type: TripDetailsDto,
  })
  trip: TripDetailsDto;
}
