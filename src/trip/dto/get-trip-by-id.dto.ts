import { ApiProperty } from '@nestjs/swagger';

export class TripItemPriceDto {
  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
    enum: ['XAF', 'USD', 'EUR', 'CAD'],
  })
  currency: string;

  @ApiProperty({
    description: 'Price in this currency',
    example: 15.5,
  })
  price: number;
}

export class TripItemDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_item_id: string;

  @ApiProperty({
    description: 'Price for this trip item (in trip currency)',
    example: 15.5,
  })
  price: number;

  @ApiProperty({
    description: 'Available weight in kilograms for this trip item',
    example: 5.0,
    required: false,
  })
  available_kg?: number;

  @ApiProperty({
    description: 'Prices in all supported currencies',
    type: [TripItemPriceDto],
    example: [
      { currency: 'XAF', price: 9300 },
      { currency: 'USD', price: 15.5 },
      { currency: 'EUR', price: 14.2 },
      { currency: 'CAD', price: 21.0 },
    ],
  })
  prices: TripItemPriceDto[];

  @ApiProperty({
    description: 'Trip item details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Electronics',
      description: 'Electronic devices and gadgets',
      image: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        url: 'https://example.com/images/electronics.jpg',
        alt_text: 'Electronics image',
      },
    },
  })
  trip_item: {
    id: string;
    name: string;
    description: string;
    image?: {
      id: string;
      url: string;
      alt_text?: string;
    };
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
    description: 'User details who created the trip',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      name: 'John Doe',
      picture: 'https://example.com/profile.jpg',
      role: 'USER',
    },
  })
  user: {
    id: string;
    email: string;
    name?: string;
    picture?: string;
    role: string;
  };

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
    required: false,
  })
  pickup?: any;

  @ApiProperty({
    description: 'Departure location details',
    example: {
      country: 'United States',
      country_code: 'US',
      region: 'New York',
      address: '789 Broadway, New York, NY 10003',
      lng: -73.9912,
      lat: 40.7308,
    },
    required: false,
  })
  departure?: any;

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
    required: false,
  })
  destination?: any;

  @ApiProperty({
    description: 'Delivery location details',
    example: {
      country: 'France',
      country_code: 'FR',
      region: 'Provence',
      address: '101 Rue de Lyon, Marseille, France',
      lng: 5.3698,
      lat: 43.2965,
    },
    required: false,
  })
  delivery?: any;

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
    example: '2024-02-16T14:00:00.000Z',
    required: false,
  })
  arrival_date?: Date;

  @ApiProperty({
    description: 'Arrival time',
    example: '2:00 PM',
    required: false,
  })
  arrival_time?: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Mode of transport ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  mode_of_transport_id?: string;

  @ApiProperty({
    description: 'Airline ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  airline_id: string;

  @ApiProperty({
    description: 'Maximum weight in kg',
    example: 25.5,
    required: false,
  })
  maximum_weight_in_kg?: number;

  @ApiProperty({
    description: 'Additional notes',
    example: 'Fragile items, handle with care',
    required: false,
  })
  notes?: string;

  @ApiProperty({
    description: 'Meetup time is flexible',
    example: false,
  })
  meetup_flexible: boolean;

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
    description: 'Mode of transport details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Airplane',
      description: 'Commercial airline transportation',
    },
    required: false,
  })
  mode_of_transport?: {
    id: string;
    name: string;
    description: string;
  };

  @ApiProperty({
    description: 'Airline details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174002',
      name: 'Delta Airlines',
      description: 'Major American airline',
    },
  })
  airline: {
    id: string;
    name: string;
    description?: string;
  };

  @ApiProperty({
    description: 'Trip items with prices',
    type: [TripItemDto],
  })
  trip_items: TripItemDto[];

  @ApiProperty({
    description:
      'Total kg booked by all active requests (excludes cancelled, declined, and refunded)',
    example: 12.5,
  })
  booked_kg: number;

  @ApiProperty({
    description: 'Available kg remaining (total_kg - booked_kg)',
    example: 37.5,
  })
  available_kg: number;

  @ApiProperty({
    description: 'Total kg capacity from all trip items',
    example: 50.0,
  })
  total_kg: number;
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
