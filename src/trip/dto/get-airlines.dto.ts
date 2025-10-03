import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAirlinesQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
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
    description: 'Number of items per page',
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

  @ApiProperty({
    description: 'Search key to filter airlines by name',
    example: 'American',
    required: false,
  })
  @IsOptional()
  @IsString()
  searchKey?: string;
}

export class AirlineSummaryDto {
  @ApiProperty({
    description: 'Airline ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Airline name',
    example: 'American Airlines',
  })
  name: string;

  @ApiProperty({
    description: 'Airline description',
    example: 'Major US airline serving domestic and international routes',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at: Date;
}

export class GetAirlinesResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Airlines retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of airlines',
    type: [AirlineSummaryDto],
  })
  airlines: AirlineSummaryDto[];

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
