import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryProductImageDto } from './create-delivery.dto';

export class UpdateDeliveryProductDto {
  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Laptop',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Product price',
    example: 500.0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

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

class ProductImageResponseDto {
  @ApiPropertyOptional({
    description: 'Image ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Image URL',
    example: 'https://example.com/image.jpg',
  })
  url: string;

  @ApiPropertyOptional({
    description: 'Alt text',
    example: 'Product image',
  })
  alt_text: string | null;
}

class DeliveryProductResponseDto {
  @ApiPropertyOptional({
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Laptop',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Product price',
    example: 500.0,
  })
  price: number;

  @ApiPropertyOptional({
    description: 'Currency',
    example: 'EUR',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Brand new laptop',
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Product weight in kg',
    example: 2.5,
  })
  weight: number | null;

  @ApiPropertyOptional({
    description: 'Product quantity',
    example: 1,
  })
  quantity: number | null;

  @ApiPropertyOptional({
    description: 'Product URL',
    example: 'https://example.com/product',
  })
  url: string | null;

  @ApiPropertyOptional({
    description: 'Product images',
    type: [ProductImageResponseDto],
  })
  images: ProductImageResponseDto[];
}

export class UpdateDeliveryProductResponseDto {
  @ApiPropertyOptional({
    description: 'Success message',
    example: 'Delivery product updated successfully',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Updated delivery product',
    type: DeliveryProductResponseDto,
  })
  product: DeliveryProductResponseDto;

  @ApiPropertyOptional({
    description: 'Updated delivery total cost',
    example: 1500.0,
  })
  deliveryTotalCost: number;
}

