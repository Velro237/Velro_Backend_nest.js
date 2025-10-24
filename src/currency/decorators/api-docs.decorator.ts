import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  CurrencyConversionRequestDto,
  CurrencyConversionResponseDto,
  TripPriceDisplayRequestDto,
  TripPriceDisplayResponseDto,
  ExchangeRatesResponseDto,
  SupportedCurrenciesResponseDto,
} from '../dto/currency-conversion.dto';

// Currency Conversion Documentation
export const ApiConvertCurrency = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Convert currency amount',
      description: 'Convert amount from one currency to another using Velro internal exchange rates. Supports XAF display conversion.',
    }),
    ApiBody({ type: CurrencyConversionRequestDto }),
    ApiResponse({
      status: 200,
      description: 'Currency converted successfully',
      type: CurrencyConversionResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid currency or amount',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Unsupported currency: JPY' },
          error: { type: 'string', example: 'Bad Request' },
          statusCode: { type: 'number', example: 400 },
        },
      },
    }),
  );

// Trip Price Display Documentation
export const ApiConvertTripPrice = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Convert trip price for display',
      description: 'Convert trip price to user currency for display. Gets base currency from trip, auto-detects user country from phone number/KYC. Europe shows EUR, Central Africa shows XAF, Canada shows CAD, others show USD.',
    }),
    ApiBody({ type: TripPriceDisplayRequestDto }),
    ApiResponse({
      status: 200,
      description: 'Trip price converted for display',
      type: TripPriceDisplayResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid trip ID or unable to detect user country',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Trip not found' },
          error: { type: 'string', example: 'Bad Request' },
          statusCode: { type: 'number', example: 400 },
        },
      },
    }),
  );

// Exchange Rates Documentation
export const ApiGetExchangeRates = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get current exchange rates',
      description: 'Returns Velro internal exchange rates for XAF conversion. These rates are fixed and used for display purposes only.',
    }),
    ApiResponse({
      status: 200,
      description: 'Exchange rates retrieved successfully',
      type: ExchangeRatesResponseDto,
    }),
  );

// Supported Currencies Documentation
export const ApiGetSupportedCurrencies = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get supported currencies',
      description: 'Returns all supported currencies including display-only currencies like XAF. Stripe currencies are used for processing.',
    }),
    ApiResponse({
      status: 200,
      description: 'Supported currencies retrieved successfully',
      type: SupportedCurrenciesResponseDto,
    }),
  );

// Extra Models for Swagger
export const ApiCurrencyExtraModels = () =>
  applyDecorators(
    ApiExtraModels(
      CurrencyConversionRequestDto,
      CurrencyConversionResponseDto,
      TripPriceDisplayRequestDto,
      TripPriceDisplayResponseDto,
      ExchangeRatesResponseDto,
      SupportedCurrenciesResponseDto,
    ),
  );
