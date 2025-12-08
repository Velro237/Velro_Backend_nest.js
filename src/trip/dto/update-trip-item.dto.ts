import { PartialType, ApiProperty, OmitType } from '@nestjs/swagger';
import { CreateTripItemDto, TranslationDto } from './create-trip-item.dto';
import { IsOptional } from 'class-validator';

export class UpdateTripItemDto extends PartialType(
  OmitType(CreateTripItemDto, ['translations'] as const),
) {
  @ApiProperty({
    description:
      'Translations as a JSON string or array. Updates existing translations by language or creates new ones. Example: [{"language":"fr","name":"Électronique","description":"Appareils et gadgets électroniques"}]',
    oneOf: [
      { type: 'string' },
      {
        type: 'array',
        items: { $ref: '#/components/schemas/TranslationDto' },
      },
    ],
    required: false,
    example:
      '[{"language":"fr","name":"Électronique","description":"Appareils et gadgets électroniques"}]',
  })
  @IsOptional()
  translations?:
    | string
    | Array<{
        language: 'en' | 'fr';
        name: string;
        description?: string;
      }>;
}

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
      translations: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          language: 'FR',
          name: 'Électronique',
          description: 'Appareils et gadgets électroniques mis à jour',
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
