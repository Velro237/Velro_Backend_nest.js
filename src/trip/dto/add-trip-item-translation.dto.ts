import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddTranslationDto {
  @ApiProperty({
    description: 'Language code',
    enum: ['en', 'fr'],
    example: 'fr',
  })
  @IsEnum(['en', 'fr'])
  language: 'en' | 'fr';

  @ApiProperty({
    description: 'Translated name',
    example: 'Électronique',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Translated description',
    example: 'Appareils et gadgets électroniques',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class AddTripItemTranslationDto {
  @ApiProperty({
    description: 'Translation to add or update',
    type: AddTranslationDto,
    example: {
      language: 'fr',
      name: 'Électronique',
      description: 'Appareils et gadgets électroniques',
    },
  })
  @ValidateNested()
  @Type(() => AddTranslationDto)
  translation: AddTranslationDto;
}

export class AddTripItemTranslationResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Translation added successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated trip item with all translations',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Electronics',
      description: 'Electronic devices and gadgets',
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
    translations: Array<{
      id: string;
      language: string;
      name: string;
      description: string | null;
    }>;
  };
}
