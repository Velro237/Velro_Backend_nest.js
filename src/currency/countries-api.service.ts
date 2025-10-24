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

  constructor(private readonly httpService: HttpService) {}

  /**
   * Get country information by country code using CountriesNow API
   */
  async getCountryInfo(countryCode: string): Promise<CountryInfo | null> {
    try {
      // Check cache first
      if (this.countryCache.has(countryCode)) {
        return this.countryCache.get(countryCode);
      }

      this.logger.log(`Fetching country info for: ${countryCode}`);

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
        c => c.iso2 && c.iso2.toLowerCase() === countryCode.toLowerCase()
      );

      if (!country) {
        this.logger.warn(`Country not found: ${countryCode}`);
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

      // Cache the result
      this.countryCache.set(countryCode, countryInfo);
      
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
