import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TripItemImageDto } from '../../shared/dto/common.dto';

export class GetTripItemsQueryDto {
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
    description: 'Number of trip items per page',
    example: 10,
    minimum: 1,
    maximum: 50,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class TripItemDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Trip item name',
    example: 'Electronics',
  })
  name: string;

  @ApiProperty({
    description: 'Trip item description',
    example: 'Electronic devices and gadgets',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Trip item image',
    type: TripItemImageDto,
    required: false,
  })
  image?: TripItemImageDto;
}

export class GetTripItemsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip items retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Array of trip items',
    type: [TripItemDto],
  })
  tripItems: TripItemDto[];

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
