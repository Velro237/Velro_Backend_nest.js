import { ApiProperty } from '@nestjs/swagger';
import { TripStatus, RequestStatus } from 'generated/prisma/client';

export class GetUserTripDetailResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip details retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Trip details with items, requests, and earnings',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      pickup: { country: 'France', city: 'Paris' },
      departure: { country: 'France', city: 'Paris' },
      destination: { country: 'USA', city: 'New York' },
      delivery: { country: 'USA', city: 'New York' },
      departure_date: '2024-02-15T10:00:00.000Z',
      departure_time: '10:00 AM',
      arrival_date: '2024-02-16T14:00:00.000Z',
      arrival_time: '02:00 PM',
      currency: 'USD',
      maximum_weight_in_kg: 20.0,
      notes: 'Please contact before delivery',
      meetup_flexible: true,
      status: 'PUBLISHED',
      fully_booked: false,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
      airline: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Air France',
        description: 'French international airline',
      },
      mode_of_transport: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Airplane',
        description: 'Air travel',
      },
      trip_items: [
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
          price: 50.0,
          available_kg: 5.0,
          trip_item: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Documents',
            description: 'Letters and documents',
            image: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              url: 'https://example.com/image.jpg',
              alt_text: 'Documents icon',
            },
          },
        },
      ],
      requests: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          status: 'APPROVED',
          cost: 150.0,
          message: 'Please handle with care',
          created_at: '2024-01-20T10:00:00.000Z',
          updated_at: '2024-01-20T10:00:00.000Z',
          user: {
            id: '123e4567-e89b-12d3-a456-426614174001',
            name: 'John Doe',
            email: 'john@example.com',
            picture: 'https://example.com/avatar.jpg',
          },
          request_items: [
            {
              trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
              quantity: 2,
              special_notes: 'Handle with care',
              trip_item: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Documents',
                description: 'Letters and documents',
                image: {
                  id: '123e4567-e89b-12d3-a456-426614174000',
                  url: 'https://example.com/image.jpg',
                  alt_text: 'Documents icon',
                },
              },
            },
          ],
        },
      ],
      available_earnings: 300.0,
      hold_earnings: 100.0,
    },
  })
  trip: {
    id: string;
    user_id: string;
    pickup: any;
    departure: any;
    destination: any;
    delivery: any;
    departure_date: Date;
    departure_time: string;
    arrival_date: Date | null;
    arrival_time: string | null;
    currency: string;
    maximum_weight_in_kg: number | null;
    notes: string | null;
    meetup_flexible: boolean;
    status: TripStatus;
    fully_booked: boolean;
    createdAt: Date;
    updatedAt: Date;
    airline: {
      id: string;
      name: string;
      description: string | null;
    };
    mode_of_transport: {
      id: string;
      name: string;
      description: string | null;
    } | null;
    trip_items: Array<{
      trip_item_id: string;
      price: number;
      available_kg: number | null;
      trip_item: {
        id: string;
        name: string;
        description: string | null;
        image: {
          id: string;
          url: string;
          alt_text: string | null;
        } | null;
      };
    }>;
    requests: Array<{
      id: string;
      user_id: string;
      status: RequestStatus;
      cost: number | null;
      message: string | null;
      created_at: Date;
      updated_at: Date;
      user: {
        id: string;
        name: string;
        email: string;
        picture: string | null;
      };
      request_items: Array<{
        trip_item_id: string;
        quantity: number;
        special_notes: string | null;
        trip_item: {
          id: string;
          name: string;
          description: string | null;
          image: {
            id: string;
            url: string;
            alt_text: string | null;
          } | null;
        };
      }>;
    }>;
    available_earnings: number;
    hold_earnings: number;
  };
}
