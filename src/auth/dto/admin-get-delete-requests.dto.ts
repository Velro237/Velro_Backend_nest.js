import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { deleteRequestStatus } from 'generated/prisma/client';

export class AdminGetDeleteRequestsQueryDto {
  @ApiProperty({
    description: 'Filter by request status',
    enum: deleteRequestStatus,
    required: false,
    example: 'PENDING',
  })
  @IsOptional()
  @IsEnum(deleteRequestStatus)
  status?: deleteRequestStatus;

  @ApiProperty({
    description: 'Page number for pagination (starts from 1)',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of requests per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class AccountDeleteRequestDto {
  @ApiProperty({
    description: 'Request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Deletion reason',
    example: 'I no longer need this account',
    required: false,
  })
  reason?: string | null;

  @ApiProperty({
    description: 'Request status',
    enum: deleteRequestStatus,
    example: 'PENDING',
  })
  status: deleteRequestStatus;

  @ApiProperty({
    description: 'User information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      name: 'John Doe',
    },
  })
  user: {
    id: string;
    email: string;
    name: string;
  };

  @ApiProperty({
    description: 'Request creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Request last update date',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}

export class AdminGetDeleteRequestsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Account delete requests retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of account delete requests',
    type: [AccountDeleteRequestDto],
  })
  requests: AccountDeleteRequestDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
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
