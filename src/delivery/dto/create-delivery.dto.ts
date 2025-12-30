import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsDateString,
  IsOptional,
  Min,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency, DeliveryStatus } from 'generated/prisma';

export class DeliveryProductImageDto {
  @ApiPropertyOptional({
    description: 'Base64 encoded image data (data:image/... or data:application/...)',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...',
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({
    description: 'Image URL (if provided, will be stored directly without Cloudinary upload)',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class CreateDeliveryProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Laptop',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Product price',
    example: 500.0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Brand new laptop',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Product weight in kg',
    example: 2.5,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({
    description: 'Product quantity',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Array of images (base64) or imageUrl. If images provided, they will be uploaded to Cloudinary. If imageUrl provided, it will be stored directly.',
    type: [DeliveryProductImageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryProductImageDto)
  @IsOptional()
  images?: DeliveryProductImageDto[];
}

export class CreateDeliveryDto {

  @ApiPropertyOptional({
    description: 'Delivery description',
    example: 'Electronics delivery',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Expected delivery date',
    example: '2024-12-31T10:00:00.000Z',
  })
  @IsDateString()
  expected_date: string;

  @ApiProperty({
    description: 'Reward amount (minimum 15)',
    example: 15,
    minimum: 15,
  })
  @IsNumber()
  @Min(15)
  reward: number;

  @ApiProperty({
    description: 'Array of delivery products',
    type: [CreateDeliveryProductDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryProductDto)
  @IsNotEmpty()
  products: CreateDeliveryProductDto[];
}

export class DeliveryProductResponseDto {
  @ApiProperty({
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Laptop',
  })
  name: string;

  @ApiProperty({
    description: 'Product price',
    example: 500.0,
  })
  price: number;

  @ApiProperty({
    description: 'Currency',
    example: 'EUR',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Brand new laptop',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Product weight in kg',
    example: 2.5,
  })
  weight?: number;

  @ApiPropertyOptional({
    description: 'Product quantity',
    example: 1,
  })
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Product URL',
    example: 'https://example.com/product',
  })
  url?: string;

  @ApiPropertyOptional({
    description: 'Product images',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        url: { type: 'string' },
        alt_text: { type: 'string', nullable: true },
      },
    },
  })
  images?: Array<{
    id: string;
    url: string;
    alt_text: string | null;
  }>;
}

export class CreateDeliveryResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Delivery created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created delivery',
    type: 'object',
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      total_cost: { type: 'number' },
      currency: { type: 'string' },
      description: { type: 'string', nullable: true },
      status: { type: 'string' },
      reward: { type: 'number' },
      expected_date: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      products: { type: 'array', items: { $ref: '#/components/schemas/DeliveryProductResponseDto' } },
    },
  })
  delivery: {
    id: string;
    userId: string;
    total_cost: number;
    currency: string;
    description: string | null;
    status: DeliveryStatus;
    reward: number;
    expected_date: Date;
    createdAt: Date;
    updatedAt: Date;
    products: DeliveryProductResponseDto[];
  };
}

