import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CountriesApiService, CountryInfo } from './countries-api.service';

export interface CountryDetectionResult {
  countryCode: string;
  countryName: string;
  source: 'phone' | 'kyc' | 'payout_country' | 'default';
  confidence: 'high' | 'medium' | 'low';
  phoneNumber?: string;
  kycData?: any;
  countryInfo?: CountryInfo;
}

@Injectable()
export class CountryDetectionService {
  private readonly logger = new Logger(CountryDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly countriesApiService: CountriesApiService,
  ) {}

  /**
   * Detect user's country from phone numbers only
   */
  async detectUserCountry(userId: string): Promise<CountryDetectionResult> {
    try {
      this.logger.log(`Detecting country for user ${userId}`);

      // Get user data with KYC records
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          kycRecords: {
            where: {
              status: 'APPROVED', // Only use approved KYC data
            },
            orderBy: {
              createdAt: 'desc', // Get most recent KYC record
            },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Priority 1: Check KYC phone number (highest confidence)
      if (user.kycRecords && user.kycRecords.length > 0) {
        const kycRecord = user.kycRecords[0];
        const countryFromKYCPhone = this.extractCountryFromKYCPhone(kycRecord.verificationData);
        
        if (countryFromKYCPhone) {
          const countryInfo = await this.countriesApiService.getCountryInfo(countryFromKYCPhone);
          this.logger.log(`Country detected from KYC phone: ${countryFromKYCPhone} (${countryInfo?.name || 'Unknown'})`);
          return {
            countryCode: countryFromKYCPhone,
            countryName: countryInfo?.name || 'Unknown',
            source: 'kyc',
            confidence: 'high',
            kycData: kycRecord.verificationData,
            countryInfo,
          };
        }
      }

      // Priority 2: Check User table phone number (medium confidence)
      if (user.phone) {
        const countryFromPhone = this.extractCountryFromPhone(user.phone);
        
        if (countryFromPhone) {
          const countryInfo = await this.countriesApiService.getCountryInfo(countryFromPhone);
          this.logger.log(`Country detected from User table phone: ${user.phone} → ${countryFromPhone} (${countryInfo?.name || 'Unknown'})`);
          return {
            countryCode: countryFromPhone,
            countryName: countryInfo?.name || 'Unknown',
            source: 'phone',
            confidence: 'medium',
            phoneNumber: user.phone,
            countryInfo,
          };
        }
      }

      // No phone number found - default to USD
      this.logger.warn('No phone number found for user, defaulting to USD');
      return {
        countryCode: 'US',
        countryName: 'United States',
        source: 'default',
        confidence: 'low',
        countryInfo: {
          code: 'US',
          name: 'United States',
          region: 'North America',
          currency: 'USD',
          phoneCode: '+1',
          continent: 'North America'
        },
      };

    } catch (error) {
      this.logger.error('Failed to detect user country:', error);
      // Default to USD if any error occurs
      return {
        countryCode: 'US',
        countryName: 'United States',
        source: 'default',
        confidence: 'low',
        countryInfo: {
          code: 'US',
          name: 'United States',
          region: 'North America',
          currency: 'USD',
          phoneCode: '+1',
          continent: 'North America'
        },
      };
    }
  }

  /**
   * Extract country code from KYC phone number (highest priority)
   */
  private extractCountryFromKYCPhone(verificationData: any): string | null {
    try {
      if (!verificationData || typeof verificationData !== 'object') {
        return null;
      }

      // Check for full_number in verification data (most reliable)
      if (verificationData.full_number) {
        const countryFromKYCPhone = this.extractCountryFromPhone(verificationData.full_number);
        if (countryFromKYCPhone) {
          this.logger.log(`Found phone number in KYC: ${verificationData.full_number} → ${countryFromKYCPhone}`);
          return countryFromKYCPhone;
        }
      }

      // Check for phone field in verification data
      if (verificationData.phone) {
        const countryFromKYCPhone = this.extractCountryFromPhone(verificationData.phone);
        if (countryFromKYCPhone) {
          this.logger.log(`Found phone number in KYC: ${verificationData.phone} → ${countryFromKYCPhone}`);
          return countryFromKYCPhone;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to extract country from KYC phone:', error);
      return null;
    }
  }


  /**
   * Extract country code from phone number
   */
  private extractCountryFromPhone(phoneNumber: string): string | null {
    try {
      if (!phoneNumber) return null;

      // Remove all non-digit characters
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Common country code patterns
      const countryCodes = {
        // Central Africa (XAF region)
        '237': 'CM', // Cameroon
        '236': 'CF', // Central African Republic
        '235': 'TD', // Chad
        '242': 'CG', // Republic of the Congo
        '240': 'GQ', // Equatorial Guinea
        '241': 'GA', // Gabon
        
        // Europe
        '33': 'FR',  // France
        '49': 'DE',  // Germany
        '39': 'IT',  // Italy
        '34': 'ES',  // Spain
        '31': 'NL',  // Netherlands
        '32': 'BE',  // Belgium
        '43': 'AT',  // Austria
        '351': 'PT', // Portugal
        '353': 'IE', // Ireland
        '358': 'FI', // Finland
        '352': 'LU', // Luxembourg
        '356': 'MT', // Malta
        '357': 'CY', // Cyprus
        '421': 'SK', // Slovakia
        '386': 'SI', // Slovenia
        '372': 'EE', // Estonia
        '371': 'LV', // Latvia
        '370': 'LT', // Lithuania
        '30': 'GR',  // Greece
        '385': 'HR', // Croatia
        '359': 'BG', // Bulgaria
        '40': 'RO',  // Romania
        '48': 'PL',  // Poland
        '420': 'CZ', // Czech Republic
        '36': 'HU',  // Hungary
        '44': 'GB',  // United Kingdom
        '41': 'CH',  // Switzerland
        '47': 'NO',  // Norway
        '46': 'SE',  // Sweden
        '45': 'DK',  // Denmark
        '354': 'IS', // Iceland
        '376': 'AD', // Andorra
        '377': 'MC', // Monaco
        '378': 'SM', // San Marino
        '379': 'VA', // Vatican City (different code)
        '423': 'LI', // Liechtenstein
        '355': 'AL', // Albania
        '389': 'MK', // North Macedonia
        '381': 'RS', // Serbia
        '382': 'ME', // Montenegro
        '387': 'BA', // Bosnia and Herzegovina
        '383': 'XK', // Kosovo
        '373': 'MD', // Moldova
        '380': 'UA', // Ukraine
        '375': 'BY', // Belarus
        '7': 'RU',   // Russia
        
        // North America
        '1': 'US',   // United States (default for +1, Canada needs additional logic)
      };

      // Check for exact matches first
      for (const [code, country] of Object.entries(countryCodes)) {
        if (cleanPhone.startsWith(code)) {
          // Special handling for +1 (US/Canada)
          if (code === '1') {
            // For +1, we need additional logic to distinguish US vs Canada
            // Check for Canadian area codes (416, 647, 905, 289, 365, 437, 519, 226, 613, 343, 705, 249, 807, 905, 289, 365, 437, 519, 226, 613, 343, 705, 249, 807, 902, 782, 506, 709, 867, 800, 866, 877, 888, 800, 866, 877, 888)
            const canadianAreaCodes = ['416', '647', '905', '289', '365', '437', '519', '226', '613', '343', '705', '249', '807', '902', '782', '506', '709', '867'];
            
            // Check if it's a Canadian number (starts with +1 followed by Canadian area code)
            if (cleanPhone.length >= 11) { // +1 + 10 digits
              const areaCode = cleanPhone.substring(1, 4); // Get first 3 digits after +1
              if (canadianAreaCodes.includes(areaCode)) {
                return 'CA'; // Canada
              }
            }
            
            return 'US'; // Default to US for +1 numbers
          }
          return country;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to extract country from phone:', error);
      return null;
    }
  }

  /**
   * Normalize country code to standard format
   */
  private normalizeCountryCode(countryCode: string): string {
    if (!countryCode) return null;
    
    const normalized = countryCode.toUpperCase().trim();
    
    // Handle common variations
    const variations = {
      'FRANCE': 'FR',
      'GERMANY': 'DE',
      'ITALY': 'IT',
      'SPAIN': 'ES',
      'NETHERLANDS': 'NL',
      'BELGIUM': 'BE',
      'AUSTRIA': 'AT',
      'PORTUGAL': 'PT',
      'IRELAND': 'IE',
      'FINLAND': 'FI',
      'LUXEMBOURG': 'LU',
      'MALTA': 'MT',
      'CYPRUS': 'CY',
      'SLOVAKIA': 'SK',
      'SLOVENIA': 'SI',
      'ESTONIA': 'EE',
      'LATVIA': 'LV',
      'LITHUANIA': 'LT',
      'GREECE': 'GR',
      'CROATIA': 'HR',
      'BULGARIA': 'BG',
      'ROMANIA': 'RO',
      'POLAND': 'PL',
      'CZECH REPUBLIC': 'CZ',
      'HUNGARY': 'HU',
      'UNITED KINGDOM': 'GB',
      'UK': 'GB',
      'SWITZERLAND': 'CH',
      'NORWAY': 'NO',
      'SWEDEN': 'SE',
      'DENMARK': 'DK',
      'ICELAND': 'IS',
      'ANDORRA': 'AD',
      'MONACO': 'MC',
      'SAN MARINO': 'SM',
      'VATICAN': 'VA',
      'LIECHTENSTEIN': 'LI',
      'ALBANIA': 'AL',
      'MACEDONIA': 'MK',
      'SERBIA': 'RS',
      'MONTENEGRO': 'ME',
      'BOSNIA': 'BA',
      'KOSOVO': 'XK',
      'MOLDOVA': 'MD',
      'UKRAINE': 'UA',
      'BELARUS': 'BY',
      'RUSSIA': 'RU',
      'CAMEROON': 'CM',
      'CENTRAL AFRICAN REPUBLIC': 'CF',
      'CHAD': 'TD',
      'CONGO': 'CG',
      'EQUATORIAL GUINEA': 'GQ',
      'GABON': 'GA',
      'UNITED STATES': 'US',
      'USA': 'US',
      'CANADA': 'CA',
    };

    return variations[normalized] || normalized;
  }

  /**
   * Get country information from API
   */
  async getCountryInfo(countryCode: string): Promise<CountryInfo | null> {
    try {
      return await this.countriesApiService.getCountryInfo(countryCode);
    } catch (error) {
      this.logger.error(`Failed to get country info for ${countryCode}:`, error);
      return null;
    }
  }

  /**
   * Get country detection summary for a user
   */
  async getCountryDetectionSummary(userId: string): Promise<{
    detectedCountry: CountryDetectionResult;
    availableSources: string[];
    recommendations: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
        include: {
          kycRecords: {
            where: { status: 'APPROVED' },
            take: 1,
          },
        },
    });

    const availableSources = [];
    const recommendations = [];

    if (user?.phone) availableSources.push('phone');
    if (user?.payout_country) availableSources.push('payout_country');
    if (user?.kycRecords && user.kycRecords.length > 0) availableSources.push('kyc');

    if (!user?.phone && !user?.payout_country && (!user?.kycRecords || user.kycRecords.length === 0)) {
      recommendations.push('Complete phone verification for better country detection');
      recommendations.push('Complete KYC verification for highest accuracy');
    }

    const detectedCountry = await this.detectUserCountry(userId);

    return {
      detectedCountry,
      availableSources,
      recommendations,
    };
  }
}
