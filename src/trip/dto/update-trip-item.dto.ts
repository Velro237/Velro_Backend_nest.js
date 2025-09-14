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
      image: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        url: 'https://example.com/images/electronics-updated.jpg',
        alt_text: 'Updated electronics image',
      },
    },
  })
  tripItem: {
    id: string;
    name: string;
    description: string | null;
    image?: {
      id: string;
      url: string;
      alt_text?: string;
    };
  };
}
