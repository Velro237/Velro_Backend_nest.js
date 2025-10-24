import { Injectable, Logger } from '@nestjs/common';
import { CountryDetectionService } from './country-detection.service';

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  timestamp: Date;
}

export interface ExchangeRates {
  USD_TO_XAF: number;
  EUR_TO_XAF: number;
  CAD_TO_XAF: number;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(private readonly countryDetectionService: CountryDetectionService) {}
  
  // Fixed exchange rates as specified
  private readonly exchangeRates: ExchangeRates = {
    USD_TO_XAF: 600,
    EUR_TO_XAF: 680,
    CAD_TO_XAF: 450,
  };

  /**
   * Convert amount from one currency to another
   * XAF is only used for display, not for processing
   */
  convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): CurrencyConversion {
    this.logger.log(`Converting ${amount} ${fromCurrency} to ${toCurrency}`);

    // If same currency, no conversion needed
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: amount,
        exchangeRate: 1,
        timestamp: new Date(),
      };
    }

    let exchangeRate: number;
    let convertedAmount: number;

    // Handle XAF conversions (display only)
    if (fromCurrency.toUpperCase() === 'XAF') {
      exchangeRate = this.getXAFToStripeRate(toCurrency);
      convertedAmount = amount / exchangeRate;
    } else if (toCurrency.toUpperCase() === 'XAF') {
      exchangeRate = this.getStripeToXAFRate(fromCurrency);
      convertedAmount = amount * exchangeRate;
    } else {
      // Convert between Stripe-supported currencies
      // First convert from source to XAF, then to target
      const toXAFRate = this.getStripeToXAFRate(fromCurrency);
      const fromXAFRate = this.getXAFToStripeRate(toCurrency);
      exchangeRate = toXAFRate / fromXAFRate;
      convertedAmount = amount * exchangeRate;
    }

    this.logger.log(
      `Conversion: ${amount} ${fromCurrency} = ${convertedAmount.toFixed(2)} ${toCurrency} (rate: ${exchangeRate})`,
    );

    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
      exchangeRate,
      timestamp: new Date(),
    };
  }

  /**
   * Get exchange rate from XAF to Stripe-supported currency
   */
  private getXAFToStripeRate(currency: string): number {
    switch (currency.toUpperCase()) {
      case 'USD':
        return this.exchangeRates.USD_TO_XAF;
      case 'EUR':
        return this.exchangeRates.EUR_TO_XAF;
      case 'CAD':
        return this.exchangeRates.CAD_TO_XAF;
      default:
        throw new Error(`Unsupported currency: ${currency}`);
    }
  }

  /**
   * Get exchange rate from Stripe-supported currency to XAF
   */
  private getStripeToXAFRate(currency: string): number {
    switch (currency.toUpperCase()) {
      case 'USD':
        return this.exchangeRates.USD_TO_XAF;
      case 'EUR':
        return this.exchangeRates.EUR_TO_XAF;
      case 'CAD':
        return this.exchangeRates.CAD_TO_XAF;
      default:
        throw new Error(`Unsupported currency: ${currency}`);
    }
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): string[] {
    return ['USD', 'EUR', 'CAD', 'XAF'];
  }

  /**
   * Get current exchange rates
   */
  getExchangeRates(): ExchangeRates {
    return { ...this.exchangeRates };
  }

  /**
   * Check if a country is in Europe
   */
  isEuropeanCountry(countryCode: string): boolean {
    const europeanCountries = [
      'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI',
      'LU', 'MT', 'CY', 'SK', 'SI', 'EE', 'LV', 'LT', 'GR', 'HR',
      'BG', 'RO', 'PL', 'CZ', 'HU', 'GB', 'CH', 'NO', 'SE', 'DK',
      'IS', 'AD', 'MC', 'SM', 'VA', 'LI', 'AL', 'MK', 'RS', 'ME',
      'BA', 'XK', 'MD', 'UA', 'BY', 'RU'
    ];
    
    return europeanCountries.includes(countryCode.toUpperCase());
  }

  /**
   * Check if a country is in Central Africa (XAF region)
   */
  isCentralAfricanCountry(countryCode: string): boolean {
    const centralAfricanCountries = ['CM', 'CF', 'TD', 'CG', 'GQ', 'GA'];
    return centralAfricanCountries.includes(countryCode.toUpperCase());
  }

  /**
   * Get display currency for a specific country
   */
  getDisplayCurrencyForCountry(countryCode: string): string {
    switch (countryCode.toUpperCase()) {
      // Central Africa region - show XAF
      case 'CM': // Cameroon
      case 'CF': // Central African Republic
      case 'TD': // Chad
      case 'CG': // Republic of the Congo
      case 'GQ': // Equatorial Guinea
      case 'GA': // Gabon
        return 'XAF';
      
      // Canada - show CAD
      case 'CA':
        return 'CAD';
      
      // Europe - show EUR (44 European countries)
      case 'FR': // France
      case 'DE': // Germany
      case 'IT': // Italy
      case 'ES': // Spain
      case 'NL': // Netherlands
      case 'BE': // Belgium
      case 'AT': // Austria
      case 'PT': // Portugal
      case 'IE': // Ireland
      case 'FI': // Finland
      case 'LU': // Luxembourg
      case 'MT': // Malta
      case 'CY': // Cyprus
      case 'SK': // Slovakia
      case 'SI': // Slovenia
      case 'EE': // Estonia
      case 'LV': // Latvia
      case 'LT': // Lithuania
      case 'GR': // Greece
      case 'HR': // Croatia
      case 'BG': // Bulgaria
      case 'RO': // Romania
      case 'PL': // Poland
      case 'CZ': // Czech Republic
      case 'HU': // Hungary
      case 'GB': // United Kingdom
      case 'CH': // Switzerland
      case 'NO': // Norway
      case 'SE': // Sweden
      case 'DK': // Denmark
      case 'IS': // Iceland
      case 'AD': // Andorra
      case 'MC': // Monaco
      case 'SM': // San Marino
      case 'VA': // Vatican City
      case 'LI': // Liechtenstein
      case 'AL': // Albania
      case 'MK': // North Macedonia
      case 'RS': // Serbia
      case 'ME': // Montenegro
      case 'BA': // Bosnia and Herzegovina
      case 'XK': // Kosovo
      case 'MD': // Moldova
      case 'UA': // Ukraine
      case 'BY': // Belarus
      case 'RU': // Russia
        return 'EUR';
      
      // USA and other countries - show USD
      case 'US': // United States
      default:
        return 'USD';
    }
  }

  /**
   * Convert trip price for display based on user's country
   * This is where XAF display logic happens
   */
  convertTripPriceForDisplay(
    price: number,
    baseCurrency: string,
    userCountry: string,
  ): { displayPrice: number; displayCurrency: string } {
    // Get display currency based on user's country
    const displayCurrency = this.getDisplayCurrencyForCountry(userCountry);
    
    this.logger.log(
      `Converting trip price for ${userCountry}: ${price} ${baseCurrency} → ${displayCurrency} ` +
      `(Europe: ${this.isEuropeanCountry(userCountry)}, Central Africa: ${this.isCentralAfricanCountry(userCountry)})`
    );

    // If display currency is same as base, no conversion needed
    if (displayCurrency === baseCurrency) {
      return {
        displayPrice: price,
        displayCurrency,
      };
    }

    // Convert for display
    const conversion = this.convertCurrency(price, baseCurrency, displayCurrency);
    
    return {
      displayPrice: conversion.convertedAmount,
      displayCurrency,
    };
  }

  /**
   * Convert payment amount from user's preferred currency to Stripe currency
   * This ensures Stripe only receives supported currencies
   */
  convertPaymentForStripe(
    amount: number,
    userCurrency: string,
    stripeCurrency: string,
  ): CurrencyConversion {
    // If user currency is XAF, convert to Stripe currency
    if (userCurrency.toUpperCase() === 'XAF') {
      return this.convertCurrency(amount, 'XAF', stripeCurrency);
    }
    
    // If user currency is already Stripe-supported, convert if needed
    if (userCurrency.toUpperCase() !== stripeCurrency.toUpperCase()) {
      return this.convertCurrency(amount, userCurrency, stripeCurrency);
    }
    
    // No conversion needed
    return {
      fromCurrency: userCurrency,
      toCurrency: stripeCurrency,
      amount,
      convertedAmount: amount,
      exchangeRate: 1,
      timestamp: new Date(),
    };
  }

  /**
   * Detect user's country (wrapper for country detection service)
   */
  async detectUserCountry(userId: string): Promise<{
    countryCode: string;
    confidence: string;
    source: string;
  }> {
    return this.countryDetectionService.detectUserCountry(userId);
  }

  /**
   * Get user's country detection summary
   */
  async getUserCountrySummary(userId: string): Promise<{
    detectedCountry: any;
    availableSources: string[];
    recommendations: string[];
    displayCurrency: string;
    isEurope: boolean;
    isCentralAfrica: boolean;
  }> {
    const summary = await this.countryDetectionService.getCountryDetectionSummary(userId);
    const detectedCountry = summary.detectedCountry;
    
    return {
      ...summary,
      displayCurrency: this.getDisplayCurrencyForCountry(detectedCountry.countryCode),
      isEurope: this.isEuropeanCountry(detectedCountry.countryCode),
      isCentralAfrica: this.isCentralAfricanCountry(detectedCountry.countryCode),
    };
  }
}
