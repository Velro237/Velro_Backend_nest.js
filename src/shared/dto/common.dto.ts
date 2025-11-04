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

export class TranslationDetailsDto {
  @ApiProperty({
    description: 'Translation ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  id: string;

  @ApiProperty({
    description: 'Language code',
    enum: ['EN', 'FR'],
    example: 'EN',
  })
  language: string;

  @ApiProperty({
    description: 'Translated name',
    example: 'Electronics',
  })
  name: string;

  @ApiProperty({
    description: 'Translated description',
    example: 'Electronic devices and gadgets',
    required: false,
  })
  description?: string | null;
}

export class TripItemDetailsDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Trip item name (default language)',
    example: 'Electronics',
  })
  name: string;

  @ApiProperty({
    description: 'Trip item description (default language)',
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

  @ApiProperty({
    description: 'Translations for name and description in different languages',
    type: [TranslationDetailsDto],
    required: false,
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        language: 'FR',
        name: 'Électronique',
        description: 'Appareils et gadgets électroniques',
      },
    ],
  })
  translations?: TranslationDetailsDto[];
}
