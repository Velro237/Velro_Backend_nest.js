import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetUserRatingsQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of ratings per page (1-100)',
    example: 10,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by rating value (1-5)',
    example: 5,
    required: false,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({
    description: 'Filter by trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  trip_id?: string;
}

export class RatingSummaryDto {
  @ApiProperty({
    description: 'Rating ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User who gave the rating',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
      email: { type: 'string', example: 'giver@example.com' },
      name: { type: 'string', example: 'John Doe', nullable: true },
    },
  })
  giver!: {
    id: string;
    email: string;
    name: string | null;
  };

  @ApiProperty({
    description: 'Trip information',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174002' },
      pickup: {
        type: 'object',
        properties: {
          country_name: { type: 'string', example: 'France' },
          city: { type: 'string', example: 'Paris' },
        },
        additionalProperties: true,
      },
      destination: {
        type: 'object',
        properties: {
          country_name: { type: 'string', example: 'USA' },
          city: { type: 'string', example: 'New York' },
        },
        additionalProperties: true,
      },
      departure_date: {
        type: 'string',
        format: 'date-time',
        example: '2024-02-01T00:00:00.000Z',
      },
    },
  })
  trip!: {
    id: string;
    pickup: Record<string, any>;
    destination: Record<string, any>;
    departure_date: Date;
  };

  @ApiProperty({
    description: 'Trip request information (if applicable)',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174003' },
      status: { type: 'string', example: 'APPROVED' },
      message: { type: 'string', example: 'I need help with transportation' },
      created_at: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-14T09:15:00.000Z',
      },
    },
    nullable: true,
  })
  request!: {
    id: string;
    status: string;
    message: string;
    created_at: Date;
  } | null;

  @ApiProperty({
    description: 'Rating value (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  rating!: number;

  @ApiProperty({
    description: 'Rating comment',
    example: 'Excellent service! Very punctual and communicative.',
    nullable: true,
  })
  comment!: string | null;

  @ApiProperty({
    description: 'Rating creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at!: Date;
}

export class GetUserRatingsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'User ratings retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'List of ratings',
    type: [RatingSummaryDto],
  })
  ratings!: RatingSummaryDto[];

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
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
