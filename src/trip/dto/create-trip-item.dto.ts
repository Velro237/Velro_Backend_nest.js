import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { Transform, Expose } from 'class-transformer';

export class TranslationDto {
  @ApiProperty({
    description: 'Language code',
    enum: ['en', 'fr'],
    example: 'en',
  })
  @Expose()
  @Transform(({ value, obj }) => {
    const input = value ?? obj?.lang;
    if (typeof input === 'string') {
      return input.toLowerCase();
    }
    return input;
  })
  @IsEnum(['en', 'fr'])
  language: 'en' | 'fr';

  @ApiProperty({
    description: 'Translated name',
    example: 'Electronics',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Translated description',
    example: 'Electronic devices and gadgets',
    required: false,
  })
  @Expose()
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateTripItemDto {
  @ApiProperty({
    description: 'Trip item name (default language)',
    example: 'Electronics',
    uniqueItems: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Trip item description (default language)',
    example: 'Electronic devices and gadgets',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Trip item image ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsOptional()
  image_id?: string;

  @ApiProperty({
    description: 'Trip item image file (multipart/form-data field)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  image?: any;

  @ApiProperty({
    description:
      'Translations JSON string. Example: [{"language":"fr","name":"Électronique","description":"Appareils et gadgets électroniques"}]',
    type: 'string',
    required: false,
  })
  @IsString()
  @IsOptional()
  translations?: string;
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
      image: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        url: 'https://example.com/images/electronics.jpg',
        alt_text: 'Electronics image',
      },
      translations: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          language: 'fr',
          name: 'Électronique',
          description: 'Appareils et gadgets électroniques',
        },
      ],
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
    translations?: Array<{
      id: string;
      language: string;
      name: string;
      description: string | null;
    }>;
  };
}
