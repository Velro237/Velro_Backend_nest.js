import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateTripItemDto } from './create-trip-item.dto';

export class UpdateTripItemDto extends PartialType(CreateTripItemDto) {}

export class UpdateTripItemResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip item updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated trip item information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Electronics',
      description: 'Updated electronic devices and gadgets',
      image_url: 'https://example.com/images/electronics-updated.jpg',
      updated_at: '2024-01-15T10:30:00.000Z',
    },
  })
  tripItem: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    updated_at: Date;
  };
}
