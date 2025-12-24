import { ApiProperty } from '@nestjs/swagger';

export class PackageCategoryDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_item_id!: string;

  @ApiProperty({
    description: 'Trip item name',
    example: 'Electronics',
  })
  trip_item_name!: string;

  @ApiProperty({
    description: 'Number of trips created with this trip item',
    example: 125,
  })
  trips_count!: number;
}

export class AdminPackageCategoryResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Package category statistics retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Array of trip items with their trip counts, ordered by highest count',
    type: [PackageCategoryDto],
  })
  packageCategories!: PackageCategoryDto[];
}

