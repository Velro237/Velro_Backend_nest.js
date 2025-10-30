import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { RequestStatus } from 'generated/prisma/client';

export enum RequestDirection {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
}

export class GetUserRequestsQueryDto {
  @ApiProperty({
    description: 'Filter requests by direction',
    enum: RequestDirection,
    example: RequestDirection.INCOMING,
    required: true,
  })
  @IsEnum(RequestDirection)
  direction: RequestDirection;

  @ApiProperty({
    description:
      'Filter requests by status. Use "ALL" to get requests with all statuses.',
    enum: [...Object.values(RequestStatus), 'ALL'],
    example: RequestStatus.PENDING,
    required: false,
  })
  @IsIn([...Object.values(RequestStatus), 'ALL'])
  @IsOptional()
  status?: RequestStatus | 'ALL';

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    default: 10,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}

export class UserRequestItemDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_item_id: string;

  @ApiProperty({
    description: 'Quantity in kg',
    example: 5,
  })
  quantity: number;

  @ApiProperty({
    description: 'Special notes for this item',
    example: 'Handle with care',
    required: false,
  })
  special_notes: string | null;

  @ApiProperty({
    description: 'Trip item details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Electronics',
      description: 'Electronic devices',
      image: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        url: 'https://example.com/image.jpg',
        alt_text: 'Electronics',
      },
    },
  })
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
}

export class UserRequestDto {
  @ApiProperty({
    description: 'Request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_id: string;

  @ApiProperty({
    description: 'User ID who made the request',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;

  @ApiProperty({
    description: 'Request status',
    enum: RequestStatus,
    example: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @ApiProperty({
    description: 'Request cost',
    example: 150.0,
    required: false,
  })
  cost: number | null;

  @ApiProperty({
    description: 'Request currency',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Request message',
    example: 'Please handle with care',
    required: false,
  })
  message: string | null;

  @ApiProperty({
    description: 'Request creation date',
    example: '2024-01-15T10:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Request last update date',
    example: '2024-01-15T10:00:00.000Z',
  })
  updated_at: Date;

  @ApiProperty({
    description:
      'User who made the request (for incoming) or trip owner (for outgoing)',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john@example.com',
      picture: 'https://example.com/avatar.jpg',
    },
  })
  user: {
    id: string;
    name: string;
    email: string;
    picture: string | null;
  };

  @ApiProperty({
    description: 'Trip details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      departure: { country: 'France', city: 'Paris' },
      destination: { country: 'USA', city: 'New York' },
      departure_date: '2024-02-15T10:00:00.000Z',
      status: 'PUBLISHED',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Jane Smith',
        email: 'jane@example.com',
        picture: 'https://example.com/avatar.jpg',
      },
    },
  })
  trip: {
    id: string;
    departure: any;
    destination: any;
    departure_date: Date;
    status: string;
    user: {
      id: string;
      name: string;
      email: string;
      picture: string | null;
    };
  };

  @ApiProperty({
    description: 'Request items',
    type: [UserRequestItemDto],
  })
  request_items: UserRequestItemDto[];
}

export class GetUserRequestsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Requests retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of requests',
    type: [UserRequestDto],
  })
  requests: UserRequestDto[];

  @ApiProperty({
    description: 'Total count of requests',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrev: boolean;
}
