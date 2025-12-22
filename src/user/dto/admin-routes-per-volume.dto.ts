import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminRoutesPerVolumeQueryDto {
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
    description: 'Number of routes per page',
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

export class RouteVolumeDto {
  @ApiProperty({
    description: 'Departure country',
    example: 'United States',
    nullable: true,
  })
  departure_country?: string | null;

  @ApiProperty({
    description: 'Destination country',
    example: 'France',
    nullable: true,
  })
  destination_country?: string | null;

  @ApiProperty({
    description: 'Number of trips on this route',
    example: 150,
  })
  count!: number;
}

export class AdminRoutesPerVolumeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Routes per volume retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Array of routes with trip counts',
    type: [RouteVolumeDto],
  })
  routes!: RouteVolumeDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 10 },
      total: { type: 'number', example: 50 },
      totalPages: { type: 'number', example: 5 },
    },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
