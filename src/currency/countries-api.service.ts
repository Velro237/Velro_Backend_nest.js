import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface CountryApiData {
  name: string;
  iso2: string;
  iso3: string;
  phone_code: string;
  capital: string;
  currency: string;
  continent: string;
}

export interface CountryApiResponse {
  error: boolean;
  msg: string;
  data: CountryApiData[];
}

export interface CountryInfo {
  code: string;
  name: string;
  region: string;
  currency: string;
  phoneCode: string;
  continent: string;
  capital?: string;
}

@Injectable()
export class CountriesApiService {
  private readonly logger = new Logger(CountriesApiService.name);
  private readonly baseUrl = 'https://countriesnow.space/api/v0.1/countries';
  private countryCache = new Map<string, CountryInfo>();

  // Fallback mapping for common countries (in case API doesn't return them)
  private readonly fallbackCountries: Map<string, CountryInfo> = new Map([
    ['CM', { code: 'CM', name: 'Cameroon', region: 'Central Africa', currency: 'XAF', phoneCode: '+237', continent: 'Africa', capital: 'Yaoundé' }],
    ['CF', { code: 'CF', name: 'Central African Republic', region: 'Central Africa', currency: 'XAF', phoneCode: '+236', continent: 'Africa', capital: 'Bangui' }],
    ['TD', { code: 'TD', name: 'Chad', region: 'Central Africa', currency: 'XAF', phoneCode: '+235', continent: 'Africa', capital: 'N\'Djamena' }],
    ['CG', { code: 'CG', name: 'Republic of the Congo', region: 'Central Africa', currency: 'XAF', phoneCode: '+242', continent: 'Africa', capital: 'Brazzaville' }],
    ['GQ', { code: 'GQ', name: 'Equatorial Guinea', region: 'Central Africa', currency: 'XAF', phoneCode: '+240', continent: 'Africa', capital: 'Malabo' }],
    ['GA', { code: 'GA', name: 'Gabon', region: 'Central Africa', currency: 'XAF', phoneCode: '+241', continent: 'Africa', capital: 'Libreville' }],
    ['US', { code: 'US', name: 'United States', region: 'North America', currency: 'USD', phoneCode: '+1', continent: 'North America', capital: 'Washington, D.C.' }],
    ['CA', { code: 'CA', name: 'Canada', region: 'North America', currency: 'CAD', phoneCode: '+1', continent: 'North America', capital: 'Ottawa' }],
    ['FR', { code: 'FR', name: 'France', region: 'Europe', currency: 'EUR', phoneCode: '+33', continent: 'Europe', capital: 'Paris' }],
    ['GB', { code: 'GB', name: 'United Kingdom', region: 'Europe', currency: 'EUR', phoneCode: '+44', continent: 'Europe', capital: 'London' }],
    ['DE', { code: 'DE', name: 'Germany', region: 'Europe', currency: 'EUR', phoneCode: '+49', continent: 'Europe', capital: 'Berlin' }],
  ]);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Get country information by country code using CountriesNow API
   */
  async getCountryInfo(countryCode: string): Promise<CountryInfo | null> {
    try {
      // Normalize country code to uppercase for consistent lookups
      const normalizedCode = countryCode.toUpperCase();

      // Check cache first (using normalized code)
      if (this.countryCache.has(normalizedCode)) {
        return this.countryCache.get(normalizedCode);
      }

      // Check fallback mapping first (before API call)
      const fallbackCountry = this.fallbackCountries.get(normalizedCode);
      if (fallbackCountry) {
        this.logger.log(`Using fallback country info for: ${normalizedCode} -> ${fallbackCountry.name}`);
        // Cache the fallback result
        this.countryCache.set(normalizedCode, fallbackCountry);
        return fallbackCountry;
      }

      this.logger.log(`Fetching country info for: ${normalizedCode}`);

      // Get all countries from API
      const response = await firstValueFrom(
        this.httpService.get<CountryApiResponse>(`${this.baseUrl}/iso`)
      );

      const responseData = response.data as CountryApiResponse;

      if (responseData.error) {
        throw new Error(responseData.msg || 'Failed to fetch countries');
      }

      // Find country by ISO2 code
      const country = responseData.data.find(
        c => c.iso2 && c.iso2.toUpperCase() === normalizedCode
      );

      if (!country) {
        this.logger.warn(`Country not found: ${normalizedCode}`);
        return null;
      }

      const countryInfo: CountryInfo = {
        code: country.iso2,
        name: country.name,
        region: this.mapContinentToRegion(country.continent),
        currency: country.currency,
        phoneCode: country.phone_code,
        continent: country.continent,
        capital: country.capital,
      };

      // Cache the result (using normalized code)
      this.countryCache.set(normalizedCode, countryInfo);
      
      this.logger.log(`Country info cached: ${countryInfo.name} (${countryInfo.code})`);
      return countryInfo;

    } catch (error) {
      this.logger.error(`Failed to fetch country info for ${countryCode}:`, error);
      return null;
    }
  }

  /**
   * Get multiple countries by codes
   */
  async getMultipleCountries(countryCodes: string[]): Promise<CountryInfo[]> {
    const promises = countryCodes.map(code => this.getCountryInfo(code));
    const results = await Promise.all(promises);
    return results.filter(Boolean) as CountryInfo[];
  }

  /**
   * Search countries by name
   */
  async searchCountries(query: string): Promise<CountryInfo[]> {
    try {
      this.logger.log(`Searching countries for: ${query}`);

      const response = await firstValueFrom(
        this.httpService.get<CountryApiResponse>(`${this.baseUrl}/iso`)
      );

      const responseData = response.data as CountryApiResponse;

      if (responseData.error) {
        throw new Error(responseData.msg || 'Failed to fetch countries');
      }

      const normalizedQuery = query.toLowerCase();
      const matchingCountries = responseData.data.filter(country =>
        (country.name && country.name.toLowerCase().includes(normalizedQuery)) ||
        (country.iso2 && country.iso2.toLowerCase().includes(normalizedQuery)) ||
        (country.iso3 && country.iso3.toLowerCase().includes(normalizedQuery))
      );

      return matchingCountries.map(country => ({
        code: country.iso2,
        name: country.name,
        region: this.mapContinentToRegion(country.continent),
        currency: country.currency,
        phoneCode: country.phone_code,
        continent: country.continent,
        capital: country.capital,
      }));

    } catch (error) {
      this.logger.error(`Failed to search countries for ${query}:`, error);
      return [];
    }
  }

  /**
   * Get all countries
   */
  async getAllCountries(): Promise<CountryInfo[]> {
    try {
      this.logger.log('Fetching all countries');

      const response = await firstValueFrom(
        this.httpService.get<CountryApiResponse>(`${this.baseUrl}/iso`)
      );

      const responseData = response.data as CountryApiResponse;

      if (responseData.error) {
        throw new Error(responseData.msg || 'Failed to fetch countries');
      }

      return responseData.data.map(country => ({
        code: country.iso2,
        name: country.name,
        region: this.mapContinentToRegion(country.continent),
        currency: country.currency,
        phoneCode: country.phone_code,
        continent: country.continent,
        capital: country.capital,
      }));

    } catch (error) {
      this.logger.error('Failed to fetch all countries:', error);
      return [];
    }
  }

  /**
   * Get countries by region (only for our supported regions)
   */
  async getCountriesByRegion(region: string): Promise<CountryInfo[]> {
    try {
      this.logger.log(`Fetching countries in region: ${region}`);

      const allCountries = await this.getAllCountries();
      return allCountries.filter(country => country.region === region);

    } catch (error) {
      this.logger.error(`Failed to fetch countries in region ${region}:`, error);
      return [];
    }
  }

  /**
   * Get country by phone code
   */
  async getCountryByPhoneCode(phoneCode: string): Promise<CountryInfo | null> {
    try {
      this.logger.log(`Finding country by phone code: ${phoneCode}`);

      const response = await firstValueFrom(
        this.httpService.get<CountryApiResponse>(`${this.baseUrl}/iso`)
      );

      const responseData = response.data as CountryApiResponse;

      if (responseData.error) {
        throw new Error(responseData.msg || 'Failed to fetch countries');
      }

      // Find country by phone code
      const country = responseData.data.find(
        c => c.phone_code === phoneCode || c.phone_code === `+${phoneCode}`
      );

      if (!country) {
        this.logger.warn(`Country not found for phone code: ${phoneCode}`);
        return null;
      }

      return {
        code: country.iso2,
        name: country.name,
        region: this.mapContinentToRegion(country.continent),
        currency: country.currency,
        phoneCode: country.phone_code,
        continent: country.continent,
        capital: country.capital,
      };

    } catch (error) {
      this.logger.error(`Failed to find country by phone code ${phoneCode}:`, error);
      return null;
    }
  }

  /**
   * Map continent to our custom regions for XAF currency system
   */
  private mapContinentToRegion(continent: string): string {
    const continentMapping: Record<string, string> = {
      'Africa': 'Central Africa', // XAF region
      'Europe': 'Europe',        // EUR region
      'North America': 'North America', // USD/CAD region
    };

    return continentMapping[continent] || 'Other';
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.countryCache.clear();
    this.logger.log('Country info cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.countryCache.size,
      keys: Array.from(this.countryCache.keys()),
    };
  }
}
