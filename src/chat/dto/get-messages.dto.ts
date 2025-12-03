import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { MessageResponseDto } from './send-message.dto';

export class GetMessagesQueryDto {
  @ApiProperty({
    description: 'Chat ID to get messages from',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  chatId: string;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of messages per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class GetMessagesResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Messages retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of messages',
    type: [MessageResponseDto],
  })
  messages: MessageResponseDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 20 },
      total: { type: 'number', example: 150 },
      totalPages: { type: 'number', example: 8 },
      hasNext: { type: 'boolean', example: true },
      hasPrev: { type: 'boolean', example: false },
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  @ApiProperty({
    description: 'Chat request data',
    type: 'object',
    nullable: true,
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      status: { type: 'string', example: 'PENDING' },
      cost: { type: 'number', example: 50000 },
      currency: { type: 'string', example: 'XAF' },
      created_at: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
      updated_at: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
      departure: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        description: 'Departure location data from the associated trip',
        example: {
          country: 'France',
          country_code: 'FR',
          region: 'Île-de-France',
          address: '123 Main St, Paris',
          lng: 2.3522,
          lat: 48.8566,
        },
      },
      user: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          email: { type: 'string', example: 'user@example.com' },
          name: { type: 'string', example: 'John Doe' },
          picture: {
            type: 'string',
            nullable: true,
            example: 'https://example.com/picture.jpg',
          },
        },
      },
      availableKgs: {
        type: 'number',
        example: 3,
        description:
          'Total quantity requested across all items (sum of request items)',
      },
      requestItems: {
        type: 'array',
        description: 'Items requested in this chat request',
        items: {
          type: 'object',
          properties: {
            trip_item_id: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174010',
            },
            quantity: { type: 'number', example: 2 },
            special_notes: {
              type: 'string',
              nullable: true,
              example: 'Handle with care',
            },
            created_at: {
              type: 'string',
              example: '2024-01-15T10:30:00.000Z',
            },
            updated_at: {
              type: 'string',
              example: '2024-01-16T10:30:00.000Z',
            },
            price: {
              type: 'number',
              nullable: true,
              example: 45,
            },
            available_kg: {
              type: 'number',
              nullable: true,
              example: 5,
            },
            trip_item: {
              type: 'object',
              nullable: true,
              properties: {
                id: {
                  type: 'string',
                  example: '123e4567-e89b-12d3-a456-426614174020',
                },
                name: { type: 'string', example: 'Electronics' },
                description: {
                  type: 'string',
                  nullable: true,
                  example: 'Electronic devices and gadgets',
                },
                image_id: {
                  type: 'string',
                  nullable: true,
                  example: 'img_123',
                },
                translations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      language: { type: 'string', example: 'en' },
                      name: { type: 'string' },
                      description: { type: 'string', nullable: true },
                    },
                  },
                  example: [
                    {
                      id: '123e4567-e89b-12d3-a456-426614174021',
                      language: 'en',
                      name: 'Electronics',
                      description: 'Electronic devices and gadgets',
                    },
                    {
                      id: '123e4567-e89b-12d3-a456-426614174022',
                      language: 'fr',
                      name: 'Électronique',
                      description: 'Appareils électroniques',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      message: {
        type: 'string',
        nullable: true,
        example: 'Please confirm availability before accepting',
      },
    },
  })
  request?: {
    id: string;
    status: string;
    cost: number;
    currency: string;
    created_at: Date;
    updated_at: Date;
    departure?: any;
    message?: string | null;
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };
    availableKgs: number;
    requestItems: Array<{
      trip_item_id: string;
      quantity: number;
      special_notes?: string | null;
      created_at: Date;
      updated_at: Date;
      price: number | null;
      available_kg: number | null;
      trip_item?: {
        id: string;
        name: string;
        description?: string | null;
        image_id?: string | null;
        translations?: Array<{
          id: string;
          language: string;
          name: string;
          description: string | null;
        }>;
      };
    }>;
  };

  @ApiProperty({
    description: 'Chat trip data',
    type: 'object',
    nullable: true,
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      pickup: { type: 'string', example: 'Douala' },
      departure: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        description: 'Departure location data',
        example: {
          country: 'France',
          country_code: 'FR',
          region: 'Île-de-France',
          address: '123 Main St, Paris',
          lng: 2.3522,
          lat: 48.8566,
        },
      },
      destination: { type: 'string', example: 'Paris' },
      departure_date: { type: 'string', example: '2024-01-20' },
      departure_time: { type: 'string', example: '14:30' },
      currency: { type: 'string', example: 'XAF' },
      airline_id: { type: 'string', nullable: true, example: 'AF123' },
      transport_mode: {
        type: 'string',
        nullable: true,
        description: 'Transport mode for ride trips (if applicable)',
        example: 'CAR',
        enum: ['CAR', 'AIRPLANE'],
      },
      seats_available: {
        type: 'number',
        nullable: true,
        description: 'Seats available for ride trips (from ride notes)',
        example: 3,
      },
      base_price_per_seat: {
        type: 'number',
        nullable: true,
        description: 'Base price per seat for ride trips (from ride notes)',
        example: 50,
      },
      driver_message: {
        type: 'string',
        nullable: true,
        description: "Driver's message/notes about the ride trip",
        example: 'Flexible on pickup within city center.',
      },
      notes: {
        type: 'string',
        nullable: true,
        description: 'Additional notes from the driver about the ride',
        example: 'No pets, small luggage only.',
      },
      stops: {
        type: 'array',
        nullable: true,
        description: 'Mid-stops along the ride route (from ride notes)',
        items: {
          type: 'object',
          properties: {
            stop_order: { type: 'number', example: 0 },
            stop_location: {
              type: 'object',
              additionalProperties: true,
              description: 'Stop location details',
            },
            price_per_seat_to_stop: {
              type: 'number',
              nullable: true,
              example: 30,
            },
          },
        },
      },
      updated_at: { type: 'string', example: '2024-01-20T10:30:00.000Z' },
      user: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          email: { type: 'string', example: 'tripcreator@example.com' },
        },
      },
    },
  })
  trip?: {
    id: string;
    pickup: string;
    departure?: any;
    destination: string;
    departure_date: Date;
    departure_time: string;
    currency: string;
    airline_id?: string;
     transport_mode?: string | null;
     seats_available?: number | null;
     base_price_per_seat?: number | null;
     driver_message?: string | null;
     notes?: string | null;
     stops?: Array<{
       stop_order: number;
       stop_location: any;
       price_per_seat_to_stop?: number | null;
     }> | null;
    updated_at: Date;
    user: {
      id: string;
      email: string;
    };
  };

  @ApiProperty({
    description: 'Chat information including members',
    type: 'object',
    nullable: true,
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      name: {
        type: 'string',
        nullable: true,
        example: 'Project Discussion',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00.000Z',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00.000Z',
      },
      members: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174001',
            },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', nullable: true, example: 'John Doe' },
            picture: {
              type: 'string',
              nullable: true,
              example: 'https://example.com/picture.jpg',
            },
            role: { type: 'string', example: 'USER', enum: ['USER', 'ADMIN'] },
            last_seen: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description:
                'Last time this member was active (general, not per chat)',
              example: '2024-01-15T10:30:00.000Z',
            },
            average_message_response_time: {
              type: 'number',
              nullable: true,
              description:
                'Average time in seconds it takes for this member to respond after the previous message sent by another member',
              example: 45.3,
            },
          },
        },
        example: [
          {
            id: '123e4567-e89b-12d3-a456-426614174001',
            email: 'user1@example.com',
            name: 'John Doe',
            picture: 'https://example.com/picture1.jpg',
            role: 'USER',
            last_seen: '2024-01-15T10:30:00.000Z',
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            email: 'user2@example.com',
            name: 'Jane Smith',
            picture: null,
            role: 'USER',
            last_seen: '2024-01-15T09:15:00.000Z',
          },
        ],
      },
    },
  })
  chat_info?: {
    id: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
    members: Array<{
      id: string;
      email: string;
      name: string | null;
      picture: string | null;
      role: string;
      last_seen: Date | null;
      average_message_response_time: number | null;
    }>;
  } | null;
}
