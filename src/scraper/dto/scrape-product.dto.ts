import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';

export class ScrapeProductDto {
  @ApiProperty({
    description: 'Product URL to scrape',
    example: 'https://www.amazon.com/dp/B08N5WRWNW',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url!: string;
}

export interface ScrapedProduct {
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrls: string[];
  weight?: number; // in kg
  inStock: boolean;
  availabilityText?: string;
  variants?: Record<string, any>; // Size, color, etc.
  source: string; // 'amazon', 'shein', etc.
  url: string; // Original URL
}

export class ScrapeBasketDto {
  @ApiProperty({
    description: 'Array of product URLs from webview basket',
    type: [String],
    example: [
      'https://www.amazon.com/dp/B08N5WRWNW',
      'https://www.shein.com/product/123',
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUrl({}, { each: true })
  urls!: string[];
}

export interface ScrapedBasket {
  products: ScrapedProduct[];
  failedUrls: Array<{ url: string; error: string }>;
}
