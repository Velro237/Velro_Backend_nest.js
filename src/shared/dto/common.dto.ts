import { ApiProperty } from '@nestjs/swagger';

export class TripItemImageDto {
  @ApiProperty({
    description: 'Image ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Image URL',
    example: 'https://example.com/images/electronics.jpg',
  })
  url: string;

  @ApiProperty({
    description: 'Image alt text',
    example: 'Electronics image',
    required: false,
  })
  alt_text?: string;
}

export class TripItemDetailsDto {
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
