import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import { ScraperService } from './scraper.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScrapeProductDto, ScrapeBasketDto } from './dto/scrape-product.dto';

@ApiTags('scraper')
@Controller('scraper')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('product')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scrape product details from URL',
    description:
      'Fetches product information (name, price, images, description, weight, variants) from supported e-commerce stores. Supports: Amazon, Shein, H&M, Nike, Zara, Apple, eBay.',
  })
  @ApiResponse({
    status: 200,
    description: 'Product details scraped successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid URL or unsupported store',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to scrape product',
  })
  async scrapeProduct(@Body() dto: ScrapeProductDto, @I18nLang() lang: string) {
    return this.scraperService.scrapeProduct(dto.url, lang);
  }

  @Post('basket')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scrape multiple products (basket import)',
    description:
      'Scrapes multiple product URLs at once. Used for webview basket import. Maximum 50 products per request.',
  })
  @ApiResponse({
    status: 200,
    description: 'Basket scraped successfully (some products may have failed)',
  })
  async scrapeBasket(@Body() dto: ScrapeBasketDto, @I18nLang() lang: string) {
    return this.scraperService.scrapeBasket(dto.urls, lang);
  }
}
