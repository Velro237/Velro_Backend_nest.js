import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsUrl } from 'class-validator';

export class CreateTripItemDto {
  @ApiProperty({
    description: 'Trip item name',
    example: 'Electronics',
    uniqueItems: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Trip item description',
    example: 'Electronic devices and gadgets',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Trip item image URL',
    example: 'https://example.com/images/electronics.jpg',
    required: false,
  })
  @IsString()
  @IsUrl()
  @IsOptional()
  image_url?: string;
}

export class CreateTripItemResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip item created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created trip item information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Electronics',
      description: 'Electronic devices and gadgets',
      image_url: 'https://example.com/images/electronics.jpg',
    },
  })
  tripItem: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
  };
}
