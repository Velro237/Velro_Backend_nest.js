import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CountriesApiService } from './countries-api.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CurrencyConversionRequestDto,
  CurrencyConversionResponseDto,
  TripPriceDisplayRequestDto,
  TripPriceDisplayResponseDto,
  ExchangeRatesResponseDto,
  SupportedCurrenciesResponseDto,
} from './dto/currency-conversion.dto';
import {
  ApiConvertCurrency,
  ApiConvertTripPrice,
  ApiGetExchangeRates,
  ApiGetSupportedCurrencies,
  ApiCurrencyExtraModels,
} from './decorators/api-docs.decorator';

@ApiTags('Currency')
@Controller('currency')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiCurrencyExtraModels()
export class CurrencyController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly countriesApiService: CountriesApiService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @ApiConvertCurrency()
  async convertCurrency(
    @Body() dto: CurrencyConversionRequestDto,
  ): Promise<CurrencyConversionResponseDto> {
    return this.currencyService.convertCurrency(
      dto.amount,
      dto.fromCurrency,
      dto.toCurrency,
    );
  }

  @Post('trip-price/display')
  @HttpCode(HttpStatus.OK)
  @ApiConvertTripPrice()
  async convertTripPriceForDisplay(
    @Body() dto: TripPriceDisplayRequestDto,
    @Request() req: any,
  ): Promise<TripPriceDisplayResponseDto> {
    // Get trip to find base currency
    const trip = await this.prisma.trip.findUnique({
      where: { id: dto.tripId },
      select: { currency: true },
    });

    if (!trip) {
      throw new BadRequestException('Trip not found');
    }

    // Auto-detect user's country and convert price
    const countryDetection = await this.currencyService.detectUserCountry(req.user.id);
    
    const result = this.currencyService.convertTripPriceForDisplay(
      dto.price,
      trip.currency,
      countryDetection.countryCode,
    );

    // Get exchange rate for response
    const conversion = this.currencyService.convertCurrency(
      dto.price,
      trip.currency,
      result.displayCurrency,
    );

    return {
      displayPrice: result.displayPrice,
      displayCurrency: result.displayCurrency,
      exchangeRate: conversion.exchangeRate,
    };
  }

  @Get('exchange-rates')
  @ApiGetExchangeRates()
  async getExchangeRates(): Promise<ExchangeRatesResponseDto> {
    return this.currencyService.getExchangeRates();
  }

  @Get('supported-currencies')
  @ApiGetSupportedCurrencies()
  async getSupportedCurrencies(): Promise<SupportedCurrenciesResponseDto> {
    const allCurrencies = this.currencyService.getSupportedCurrencies();
    const stripeCurrencies = ['USD', 'EUR', 'CAD'];
    const displayCurrencies = ['XAF'];

    return {
      currencies: allCurrencies,
      stripeCurrencies,
      displayCurrencies,
    };
  }

  @Get('check-region/:countryCode')
  @ApiOperation({
    summary: 'Check country region',
    description: 'Check if a country is in Europe, Central Africa, or other regions',
  })
  @ApiResponse({
    status: 200,
    description: 'Country region information',
    schema: {
      type: 'object',
      properties: {
        countryCode: { type: 'string', example: 'FR' },
        isEurope: { type: 'boolean', example: true },
        isCentralAfrica: { type: 'boolean', example: false },
        displayCurrency: { type: 'string', example: 'EUR' },
        region: { type: 'string', example: 'Europe' },
      },
    },
  })
  async checkCountryRegion(@Param('countryCode') countryCode: string): Promise<{
    countryCode: string;
    isEurope: boolean;
    isCentralAfrica: boolean;
    displayCurrency: string;
    region: string;
  }> {
    const isEurope = this.currencyService.isEuropeanCountry(countryCode);
    const isCentralAfrica = this.currencyService.isCentralAfricanCountry(countryCode);
    const displayCurrency = this.currencyService.getDisplayCurrencyForCountry(countryCode);
    
    let region = 'Other';
    if (isEurope) region = 'Europe';
    else if (isCentralAfrica) region = 'Central Africa';
    else if (countryCode.toUpperCase() === 'CA') region = 'North America (Canada)';
    else if (countryCode.toUpperCase() === 'US') region = 'North America (USA)';
    
    return {
      countryCode: countryCode.toUpperCase(),
      isEurope,
      isCentralAfrica,
      displayCurrency,
      region,
    };
  }

  @Post('trip-price/auto-detect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Auto-detect user country and convert trip price',
    description: 'Automatically detect user country from phone/KYC data and convert trip price for display using trip data',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tripId: { type: 'string', example: 'trip-uuid' },
        price: { type: 'number', example: 100 },
      },
      required: ['tripId', 'price'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Trip price converted using auto-detected country',
    schema: {
      type: 'object',
      properties: {
        displayPrice: { type: 'number', example: 68000 },
        displayCurrency: { type: 'string', example: 'XAF' },
        detectedCountry: { type: 'string', example: 'CM' },
        confidence: { type: 'string', example: 'high' },
        source: { type: 'string', example: 'kyc' },
        baseCurrency: { type: 'string', example: 'EUR' },
      },
    },
  })
  async convertTripPriceForUser(
    @Body() dto: { tripId: string; price: number },
    @Request() req: any,
  ): Promise<{
    displayPrice: number;
    displayCurrency: string;
    detectedCountry: string;
    confidence: string;
    source: string;
    baseCurrency: string;
  }> {
    // Get trip to find base currency
    const trip = await this.prisma.trip.findUnique({
      where: { id: dto.tripId },
      select: { currency: true },
    });

    if (!trip) {
      throw new BadRequestException('Trip not found');
    }

    // Auto-detect user's country and convert price
    const countryDetection = await this.currencyService.detectUserCountry(req.user.id);
    
    const result = this.currencyService.convertTripPriceForDisplay(
      dto.price,
      trip.currency,
      countryDetection.countryCode,
    );

    return {
      displayPrice: result.displayPrice,
      displayCurrency: result.displayCurrency,
      detectedCountry: countryDetection.countryCode,
      confidence: countryDetection.confidence,
      source: countryDetection.source,
      baseCurrency: trip.currency,
    };
  }

  @Get('user-country-summary')
  @ApiOperation({
    summary: 'Get user country detection summary',
    description: 'Get detailed information about how user country was detected and available sources',
  })
  @ApiResponse({
    status: 200,
    description: 'User country detection summary',
    schema: {
      type: 'object',
      properties: {
        detectedCountry: {
          type: 'object',
          properties: {
            countryCode: { type: 'string', example: 'CM' },
            source: { type: 'string', example: 'kyc' },
            confidence: { type: 'string', example: 'high' },
          },
        },
        availableSources: { type: 'array', items: { type: 'string' }, example: ['phone', 'kyc'] },
        recommendations: { type: 'array', items: { type: 'string' } },
        displayCurrency: { type: 'string', example: 'XAF' },
        isEurope: { type: 'boolean', example: false },
        isCentralAfrica: { type: 'boolean', example: true },
      },
    },
  })
  async getUserCountrySummary(@Request() req: any): Promise<{
    detectedCountry: any;
    availableSources: string[];
    recommendations: string[];
    displayCurrency: string;
    isEurope: boolean;
    isCentralAfrica: boolean;
  }> {
    return this.currencyService.getUserCountrySummary(req.user.id);
  }


  // ============================================
  // XAF Currency System - Country Detection
  // ============================================

  @Get('country/info/:countryCode')
  @ApiOperation({
    summary: 'Get country information for XAF system',
    description: 'Get country information with static data first, API fallback for unknown countries',
  })
  @ApiParam({
    name: 'countryCode',
    description: 'Country code to get information for',
    example: 'CM',
  })
  @ApiResponse({
    status: 200,
    description: 'Country information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CM' },
        name: { type: 'string', example: 'Cameroon' },
        region: { type: 'string', example: 'Central Africa' },
        currency: { type: 'string', example: 'XAF' },
        phoneCode: { type: 'string', example: '+237' },
        continent: { type: 'string', example: 'Africa' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async getCountryInfo(@Param('countryCode') countryCode: string): Promise<any> {
    const countryInfo = await this.countriesApiService.getCountryInfo(countryCode);
    if (!countryInfo) {
      throw new Error(`Country not found: ${countryCode}`);
    }
    return countryInfo;
  }

  @Get('country/phone/:phoneCode')
  @ApiOperation({
    summary: 'Get country by phone code for XAF system',
    description: 'Find country information using phone country code (useful for phone-based detection)',
  })
  @ApiParam({
    name: 'phoneCode',
    description: 'Phone country code (e.g., +237, +33)',
    example: '+237',
  })
  @ApiResponse({
    status: 200,
    description: 'Country found by phone code',
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found for phone code',
  })
  async getCountryByPhoneCode(@Param('phoneCode') phoneCode: string): Promise<any> {
    const countryInfo = await this.countriesApiService.getCountryByPhoneCode(phoneCode);
    if (!countryInfo) {
      throw new Error(`Country not found for phone code: ${phoneCode}`);
    }
    return countryInfo;
  }
}
