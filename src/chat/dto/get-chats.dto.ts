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
      },
    },
  })
  members: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
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
