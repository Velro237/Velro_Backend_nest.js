import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum UserStatusFilter {
  ALL = 'all',
  REGULAR = 'regular',
  BUSINESS = 'business',
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
  SUSPENDED = 'suspended',
}

export class AdminGetAllUsersQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    required: false,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description:
      'Search key to filter users by userId, firstName, lastName, username, email, or companyName',
    example: 'john',
    required: false,
  })
  @IsOptional()
  @IsString()
  searchKey?: string;

  @ApiProperty({
    description: 'Filter users by status',
    enum: UserStatusFilter,
    example: UserStatusFilter.ALL,
    required: false,
    default: UserStatusFilter.ALL,
  })
  @IsOptional()
  @IsEnum(UserStatusFilter)
  status?: UserStatusFilter = UserStatusFilter.ALL;
}

export class AdminUserDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user_123',
  })
  id!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Username',
    example: 'johndoe',
    required: false,
  })
  username?: string | null;

  @ApiProperty({
    description: 'First name',
    example: 'John',
    required: false,
  })
  firstName?: string | null;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    required: false,
  })
  lastName?: string | null;

  @ApiProperty({
    description: 'User country',
    example: 'cameroon',
    required: false,
  })
  country?: string | null;

  @ApiProperty({
    description: 'Whether user is a freight forwarder (business user)',
    example: false,
  })
  isFreightForwarder!: boolean;

  @ApiProperty({
    description: 'User creation date',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Total number of requests made by the user',
    example: 15,
  })
  total_request!: number;

  @ApiProperty({
    description: 'Total number of trips created by the user',
    example: 10,
  })
  total_trips!: number;

  @ApiProperty({
    description:
      'Total revenue from confirmed requests on trips created by the user',
    example: 1250.5,
  })
  total_revenue!: number;

  @ApiProperty({
    description: 'User average rating out of 5',
    example: 4.5,
  })
  rating!: number;

  @ApiProperty({
    description:
      'User status: active (KYC success), unverified (KYC failed), travelling (any ongoing trip)',
    enum: ['active', 'unverified', 'travelling'],
    example: 'active',
  })
  status!: 'active' | 'unverified' | 'travelling';

  @ApiProperty({
    description: 'Whether the user account is soft deleted',
    example: false,
  })
  is_deleted!: boolean;

  @ApiProperty({
    description: 'Latest KYC record for the user',
    type: 'object',
    nullable: true,
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      status: { type: 'string', example: 'APPROVED' },
      provider: { type: 'string', example: 'DIDIT' },
      rejectionReason: { type: 'string', example: null, nullable: true },
      createdAt: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-01T00:00:00Z',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-01T00:00:00Z',
      },
      verifiedAt: {
        type: 'string',
        format: 'date-time',
        example: null,
        nullable: true,
      },
    },
  })
  kyc!: {
    id: string;
    status: string;
    provider: string;
    rejectionReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
    verifiedAt?: Date | null;
  } | null;
}

export class AdminGetAllUsersResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Users retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'List of users',
    type: [AdminUserDto],
  })
  users!: AdminUserDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 20 },
      total: { type: 'number', example: 100 },
      totalPages: { type: 'number', example: 5 },
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
