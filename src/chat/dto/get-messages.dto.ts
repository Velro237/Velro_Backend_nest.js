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
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };
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
          },
        },
        example: [
          {
            id: '123e4567-e89b-12d3-a456-426614174001',
            email: 'user1@example.com',
            name: 'John Doe',
            picture: 'https://example.com/picture1.jpg',
            role: 'USER',
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            email: 'user2@example.com',
            name: 'Jane Smith',
            picture: null,
            role: 'USER',
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
    }>;
  } | null;
}
