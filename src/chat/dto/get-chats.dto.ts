import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetChatsQueryDto {
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
    description: 'Number of chats per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Search term for chat names',
    example: 'project',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ChatSummaryDto {
  @ApiProperty({
    description: 'Chat ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Chat name',
    example: 'Project Discussion',
    required: false,
  })
  name: string | null;

  @ApiProperty({
    description: 'Last message object with full details',
    required: false,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      content: 'Hello everyone!',
      type: 'TEXT',
      imageUrls: null,
      data: { status: 'PENDING' },
      createdAt: '2024-01-15T10:30:00.000Z',
      sender: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'user@example.com',
        name: 'John Doe',
        picture: 'https://example.com/avatar.jpg',
      },
    },
  })
  lastMessage: {
    id: string;
    content: string | null;
    type: string;
    imageUrls: string[] | null;
    data: Record<string, any> | null;
    createdAt: Date;
    sender: {
      id: string;
      email: string;
      name: string;
      picture: string | null;
    } | null;
  } | null;

  @ApiProperty({
    description: 'Last message timestamp',
    example: '2024-01-15T10:30:00.000Z',
    required: false,
  })
  lastMessageAt: Date | null;

  @ApiProperty({
    description: 'Number of unread messages',
    example: 5,
  })
  unreadCount: number;

  @ApiProperty({
    description: 'Chat members',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
        picture: { type: 'string' },
      },
    },
  })
  members: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    picture: string | null;
  }>;

  @ApiProperty({
    description: 'Chat creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Trip information if chat is linked to a trip',
    required: false,
  })
  trip?: {
    id: string;
    pickup: any;
    departure: any;
    destination: any;
    departure_date: Date;
    departure_time: string;
    currency: string;
    airline_id: string;
    user?: {
      id: string;
      email: string;
    };
    trip_items?: Array<{
      trip_item_id: string;
      price: number | null;
      available_kg: number | null;
      prices: Array<{
        currency: string;
        price: number;
      }>;
      trip_item: {
        id: string;
        name: string;
        description: string | null;
        image_id: string | null;
        translations: Array<{
          id: string;
          language: string;
          name: string;
          description: string | null;
        }>;
      } | null;
    }>;
  };

  @ApiProperty({
    description: 'Request information if chat is linked to a request',
    required: false,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'PENDING',
      cost: 150.0,
      currency: 'USD',
      created_at: '2024-01-15T10:00:00.000Z',
      availableKgs: 25,
      user: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'user@example.com',
        name: 'John Doe',
        picture: 'https://example.com/avatar.jpg',
      },
      requestItems: [
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174002',
          quantity: 5,
          special_notes: 'Handle with care',
          trip_item: {
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Documents',
            description: 'Letters and documents',
            image_id: '123e4567-e89b-12d3-a456-426614174003',
            translations: [
              {
                id: '123e4567-e89b-12d3-a456-426614174004',
                language: 'en',
                name: 'Documents',
                description: 'Letters and documents',
              },
              {
                id: '123e4567-e89b-12d3-a456-426614174005',
                language: 'fr',
                name: 'Documents',
                description: 'Lettres et documents',
              },
            ],
          },
        },
      ],
    },
  })
  request?: {
    id: string;
    status: string;
    cost: number | null;
    currency: string;
    created_at: Date;
    availableKgs: number;
    user?: {
      id: string;
      email: string;
      name: string;
      picture: string;
    };
    requestItems?: Array<{
      trip_item_id: string;
      quantity: number;
      special_notes: string | null;
      trip_item: {
        id: string;
        name: string;
        description: string | null;
        image_id: string | null;
        translations: Array<{
          id: string;
          language: string;
          name: string;
          description: string | null;
        }>;
      } | null;
    }>;
  };
}

export class GetChatsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Chats retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of chats',
    type: [ChatSummaryDto],
  })
  chats: ChatSummaryDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 10 },
      total: { type: 'number', example: 25 },
      totalPages: { type: 'number', example: 3 },
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
}
