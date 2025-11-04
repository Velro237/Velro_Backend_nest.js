import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUrl,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TranslationDto {
  @ApiProperty({
    description: 'Language code',
    enum: ['EN', 'FR'],
    example: 'EN',
  })
  @IsEnum(['EN', 'FR'])
  language: 'EN' | 'FR';

  @ApiProperty({
    description: 'Translated name',
    example: 'Electronics',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Translated description',
    example: 'Electronic devices and gadgets',
    required: false,
  })
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
    description: 'Translations for name and description in different languages',
    type: [TranslationDto],
    required: false,
    example: [
      {
        language: 'FR',
        name: 'Électronique',
        description: 'Appareils et gadgets électroniques',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  @IsOptional()
  translations?: TranslationDto[];
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
          language: 'FR',
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
