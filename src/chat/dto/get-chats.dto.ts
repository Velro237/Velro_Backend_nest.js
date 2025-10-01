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
    description: 'Last message content',
    example: 'Hello everyone!',
    required: false,
  })
  lastMessage: string | null;

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
        role: { type: 'string' },
      },
    },
  })
  members: Array<{
    id: string;
    email: string;
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
    destination: any;
    departure_date: Date;
    departure_time: string;
    price_per_kg: number;
    fullSuitcaseOnly: boolean;
    user?: {
      id: string;
      email: string;
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
