import { ApiProperty } from '@nestjs/swagger';
import { TripItemDetailsDto } from '../../shared/dto/common.dto';

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

export class GetRequestByIdResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Complete request information with full trip details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174002',
      trip_id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'PENDING',
      message: 'I would like to request these items',
      cost: 31.98,
      currency: 'USD',
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'requester@example.com',
        name: 'John Requester',
        picture: 'https://example.com/requester.jpg',
        role: 'USER',
        kycRecord: {
          id: 'kyc-456',
          status: 'VERIFIED',
          provider: 'DIDIT',
          rejectionReason: null,
          createdAt: '2024-01-10T10:00:00.000Z',
          updatedAt: '2024-01-10T10:00:00.000Z',
        },
      },
      trip: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174003',
        user: {
          id: '123e4567-e89b-12d3-a456-426614174003',
          email: 'tripowner@example.com',
          name: 'Trip Owner',
          picture: 'https://example.com/owner.jpg',
          role: 'USER',
          kycRecord: {
            id: 'kyc-123',
            status: 'VERIFIED',
            provider: 'DIDIT',
            rejectionReason: null,
            createdAt: '2024-01-10T10:00:00.000Z',
            updatedAt: '2024-01-10T10:00:00.000Z',
          },
        },
        pickup: {
          country: 'United States',
          country_code: 'US',
          region: 'California',
        },
        departure: {
          country: 'United States',
          country_code: 'US',
          region: 'New York',
        },
        destination: {
          country: 'France',
          country_code: 'FR',
          region: 'Île-de-France',
        },
        delivery: {
          country: 'France',
          country_code: 'FR',
          region: 'Provence',
        },
        departure_date: '2024-02-15T10:00:00.000Z',
        departure_time: '10:00 AM',
        arrival_date: '2024-02-16T14:00:00.000Z',
        arrival_time: '2:00 PM',
        currency: 'USD',
        maximum_weight_in_kg: 25.5,
        notes: 'Handle with care',
        meetup_flexible: true,
        status: 'PUBLISHED',
        mode_of_transport_id: '123e4567-e89b-12d3-a456-426614174010',
        airline_id: '123e4567-e89b-12d3-a456-426614174011',
        mode_of_transport: {
          id: '123e4567-e89b-12d3-a456-426614174010',
          name: 'Airplane',
          description: 'Commercial flights',
        },
        airline: {
          id: '123e4567-e89b-12d3-a456-426614174011',
          name: 'Delta Airlines',
          description: 'Major airline',
        },
        trip_items: [
          {
            trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
            price: 15.99,
            available_kg: 5.0,
            prices: [
              { currency: 'XAF', price: 9600 },
              { currency: 'USD', price: 15.99 },
              { currency: 'EUR', price: 14.5 },
              { currency: 'CAD', price: 21.5 },
            ],
            trip_item: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Electronics',
              description: 'Electronic devices',
              image: {
                id: '123e4567-e89b-12d3-a456-426614174004',
                url: 'https://example.com/electronics.jpg',
                alt_text: 'Electronics image',
              },
            },
          },
        ],
      },
      request_items: [
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 2,
          price: 15.99,
          special_notes: 'Handle with care',
          trip_item: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Electronics',
            description: 'Electronic devices',
            image: {
              id: '123e4567-e89b-12d3-a456-426614174004',
              url: 'https://example.com/electronics.jpg',
              alt_text: 'Electronics image',
            },
          },
        },
      ],
      images: [
        {
          id: '123e4567-e89b-12d3-a456-426614174005',
          url: 'https://example.com/request-1.jpg',
          alt_text: 'Request items',
        },
      ],
    },
  })
  request: {
      id: string;
      trip_id: string;
      user_id: string;
      status: string;
      message?: string;
      cost?: number;
      currency?: string | null;
      created_at: Date;
      updated_at: Date;
    user: {
      id: string;
      email: string;
      name?: string;
      picture?: string;
      role: string;
      kycRecord?: {
        id: string;
        status: string;
        provider: string;
        rejectionReason?: string;
        createdAt: Date;
        updatedAt: Date;
      } | null;
    };
    trip: {
      id: string;
      user_id: string;
      user: {
        id: string;
        email: string;
        name?: string;
        picture?: string;
        role: string;
        kycRecord?: {
          id: string;
          status: string;
          provider: string;
          rejectionReason?: string;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      };
      pickup?: any;
      departure?: any;
      destination?: any;
      delivery?: any;
      departure_date: Date;
      departure_time: string;
      arrival_date?: Date;
      arrival_time?: string;
      currency: string;
      maximum_weight_in_kg?: number;
      notes?: string;
      meetup_flexible: boolean;
      status: string;
      mode_of_transport_id?: string;
      airline_id: string;
      mode_of_transport?: {
        id: string;
        name: string;
        description?: string;
      };
      airline: {
        id: string;
        name: string;
        description?: string;
      };
      trip_items: {
        trip_item_id: string;
        price: number;
        available_kg?: number;
        prices: TripItemPriceDto[];
        trip_item: TripItemDetailsDto;
      }[];
    };
    request_items?: {
      trip_item_id: string;
      quantity: number;
      price: number;
      special_notes?: string;
      trip_item?: TripItemDetailsDto;
    }[];
    images?: {
      id: string;
      url: string;
      alt_text?: string;
    }[];
  };
}
