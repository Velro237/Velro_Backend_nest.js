import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminUsersRankingQueryDto {
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
    description: 'Number of users per page',
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
  @Max(100)
  limit?: number = 10;
}

export class UserRankingDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  lastName!: string;

  @ApiProperty({
    description: 'Number of completed trips',
    example: 25,
  })
  completedTripsCount!: number;

  @ApiProperty({
    description:
      'Success rate as percentage (requests with DELIVERED or REVIEWED status / total requests)',
    example: 85.5,
  })
  successRate!: number;

  @ApiProperty({
    description:
      'Total revenue in EUR (sum of request costs excluding PENDING, ACCEPTED, DECLINED, CANCELLED, REFUNDED)',
    example: 12500.75,
  })
  totalRevenueEUR!: number;

  @ApiProperty({
    description: 'Average rating out of 5',
    example: 4.5,
    nullable: true,
  })
  rating!: number | null;
}

export class AdminUsersRankingResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Users ranking retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Array of users ranked by trip revenue',
    type: [UserRankingDto],
  })
  users!: UserRankingDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 10 },
      total: { type: 'number', example: 150 },
      totalPages: { type: 'number', example: 15 },
    },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
