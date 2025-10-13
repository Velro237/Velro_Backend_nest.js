import {
  BadRequestException,
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentAction, PaymentCarrier } from '../entitiy/mobilemoney.entity';
import { I18nService } from 'nestjs-i18n';
import { MobilemoneyCashoutResponseDto } from '../dto/mobilemoney-cashout.dto';
import { MobilemoneyDepositResponseDto } from '../dto/mobilemoney-deposit.dto';
import { MoalaBalanceResponseDto } from '../dto/moala-balance.dto';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MobilemoneyService {
  private readonly logger = new Logger(MobilemoneyService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUri: string;
  private readonly appKey: string;
  private readonly secretKey: string;

  private readonly serviceCodes = {
    PAIEMENTMARCHAND_MTN_CM: 'PAIEMENTMARCHAND_MTN_CM',
    PAIEMENTMARCHAND_ORANGE_CM: 'PAIEMENTMARCHAND_ORANGE_CM',
    CASHIN_ORANGE_CM_DIS: 'CASHIN_ORANGE_CM_DIS',
    CASHIN_MTN_CM_DIS: 'CASHIN_MTN_CM_DIS',
  } as const;

  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    this.baseUri = this.configService.get<string>('MOALA_URL');
    this.appKey = this.configService.get<string>('MOALA_API_KEY');
    this.secretKey = this.configService.get<string>('MOALA_SECRET');

    this.httpClient = axios.create({
      baseURL: this.baseUri,
    });
  }

  /**
   * Generate HMAC SHA256 signature for Moala API
   */
  private generateHmacSha256Hex(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Get account balance
   */
  async balance(lang: string = 'en'): Promise<MoalaBalanceResponseDto> {
    try {
      this.validateConfiguration(lang);

      const timestamp = Math.floor(Date.now() / 1000);
      const sign = this.generateHmacSha256Hex(
        `${timestamp}GET/v1/api/balance`,
        this.secretKey,
      );

      console.log(this.appKey);
      console.log(this.secretKey);
      console.log(sign);
      const response = await this.httpClient.get('/v1/api/balance', {
        headers: {
          'LP-ACCESS-SIGN': sign,
          'LP-ACCESS-KEY': this.appKey,
          'Content-Type': 'application/json',
          'LP-ACCESS-TIMESTAMP': `${timestamp}`,
        },
      });

      this.logger.log(`Balance retrieved: ${JSON.stringify(response.data)}`);

      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.balanceRetrieved',
        {
          lang,
          defaultValue: 'Balance retrieved successfully',
        },
      );

      return {
        message,
        balance: response.data,
      };
    } catch (error) {
      console.log(error);
      this.logger.error(`Balance check error: ${error.message}`, error.stack);
      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.balanceFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve balance',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Check transaction status
   */
  async checkTransaction(partnerId: string, lang: string = 'en'): Promise<any> {
    try {
      this.validateConfiguration(lang);

      const timestamp = Math.floor(Date.now() / 1000);
      const endpoint = `/v1/api/transaction/check/${partnerId}`;
      const sign = this.generateHmacSha256Hex(
        `${timestamp}GET${endpoint}`,
        this.secretKey,
      );

      const response = await this.httpClient.get(endpoint, {
        headers: {
          'LP-ACCESS-SIGN': sign,
          'LP-ACCESS-KEY': this.appKey,
          'Content-Type': 'application/json',
          'LP-ACCESS-TIMESTAMP': `${timestamp}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(
        `Transaction check error: ${error.message}`,
        error.stack,
      );
      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.checkTransactionFailed',
        {
          lang,
          defaultValue: 'Failed to check transaction status',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Perform KYC check
   */
  async kyc(
    phoneNumber: string,
    serviceCode: string,
    lang: string = 'en',
  ): Promise<any> {
    try {
      this.validateConfiguration(lang);

      const timestamp = Math.floor(Date.now() / 1000);
      const endpoint = `/v1/api/kyc/${serviceCode}/${phoneNumber}`;
      const sign = this.generateHmacSha256Hex(
        `${timestamp}GET${endpoint}`,
        this.secretKey,
      );

      const response = await this.httpClient.get(endpoint, {
        headers: {
          'LP-ACCESS-SIGN': sign,
          'LP-ACCESS-KEY': this.appKey,
          'Content-Type': 'application/json',
          'LP-ACCESS-TIMESTAMP': `${timestamp}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(`KYC check error: ${error.message}`, error.stack);
      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.kycFailed',
        {
          lang,
          defaultValue: 'Failed to perform KYC check',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Cashout (deposit to user's mobile money account)
   * @param phoneNumber - Mobile money phone number
   * @param serviceCode - Service code for the carrier
   * @param amount - Amount to cashout
   * @param lang - Language for error messages
   * @returns Transaction data with unique partnerId
   */
  async cashout(
    phoneNumber: string,
    serviceCode: string,
    amount: number,
    lang: string = 'en',
  ): Promise<{ partnerId: string; [key: string]: any }> {
    try {
      this.validateConfiguration(lang);

      // Generate unique UUID for this transaction
      const partnerId = uuidv4();

      const data = {
        amount,
        transactionType: 'deposit',
        serviceCode,
        phoneNumber,
        partnerId,
      };

      console.log('data', data);

      const timestamp = Math.floor(Date.now() / 1000);
      const sign = this.generateHmacSha256Hex(
        `${timestamp}POST/v1/api/transaction/payment${JSON.stringify(data)}`,
        this.secretKey,
      );

      const response = await this.httpClient.post(
        '/v1/api/transaction/payment',
        data,
        {
          headers: {
            'LP-ACCESS-SIGN': sign,
            'LP-ACCESS-KEY': this.appKey,
            'Content-Type': 'application/json',
            'LP-ACCESS-TIMESTAMP': `${timestamp}`,
          },
        },
      );

      this.logger.log(
        `Cashout successful - partnerId: ${partnerId}, response: ${JSON.stringify(response.data)}`,
      );
      return { partnerId, ...response.data };
    } catch (error) {
      this.logger.error(`Cashout error: ${error.message}`, error.stack);
      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.cashoutFailed',
        {
          lang,
          defaultValue: 'Failed to process cashout',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Cashin (withdrawal from user's mobile money account)
   * @param phoneNumber - Mobile money phone number
   * @param serviceCode - Service code for the carrier
   * @param amount - Amount to cashin
   * @param lang - Language for error messages
   * @returns Transaction data with unique partnerId
   */
  async cashin(
    phoneNumber: string,
    serviceCode: string,
    amount: number,
    lang: string = 'en',
  ): Promise<{ partnerId: string; [key: string]: any }> {
    try {
      this.validateConfiguration(lang);

      // Generate unique UUID for this transaction
      const partnerId = uuidv4();

      const data = {
        amount,
        transactionType: 'withdrawal',
        serviceCode,
        phoneNumber,
        partnerId,
      };
      console.log('data', data);

      const timestamp = Math.floor(Date.now() / 1000);
      const sign = this.generateHmacSha256Hex(
        `${timestamp}POST/v1/api/transaction/withdrawal${JSON.stringify(data)}`,
        this.secretKey,
      );

      const response = await this.httpClient.post(
        '/v1/api/transaction/withdrawal',
        data,
        {
          headers: {
            'LP-ACCESS-SIGN': sign,
            'LP-ACCESS-KEY': this.appKey,
            'Content-Type': 'application/json',
            'LP-ACCESS-TIMESTAMP': `${timestamp}`,
          },
        },
      );

      this.logger.log(
        `Cashin successful - partnerId: ${partnerId}, response: ${JSON.stringify(response.data)}`,
      );
      return { partnerId, ...response.data };
    } catch (error) {
      this.logger.error(`Cashin error: ${error.message}`, error.stack);
      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.cashinFailed',
        {
          lang,
          defaultValue: 'Failed to process cashin',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Make withdrawal - High-level method with validation
   */
  async makeWithdrawal(
    amount: number,
    phoneNumber: string,
    lang: string = 'en',
  ): Promise<MobilemoneyCashoutResponseDto> {
    try {
      this.validateConfiguration(lang);

      // Validate phone number carrier
      const carrier = this.getCarrier(phoneNumber);
      if (!carrier) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.invalidPhoneNumber',
          {
            lang,
            defaultValue:
              'Invalid phone number. Must be a valid Cameroonian mobile number (MTN or Orange)',
          },
        );
        throw new BadRequestException(message);
      }

      // Get service code for the carrier
      const serviceCode = this.getServiceCode(
        carrier,
        PaymentAction.PAIEMENTMARCHAND,
      );
      console.log('serviceCode', serviceCode);
      if (!serviceCode) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.unsupportedCarrier',
          {
            lang,
            defaultValue: 'Carrier not supported for cashout',
          },
        );
        throw new BadRequestException(message);
      }

      // Execute cashout (generates unique partnerId internally)
      const result = await this.cashout(phoneNumber, serviceCode, amount, lang);

      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.withdrawalInitiated',
        {
          lang,
          defaultValue: 'Withdrawal initiated successfully',
        },
      );

      return {
        message,
        transaction: {
          transactionId: result.partnerId, // Use partnerId as transaction ID
          amount,
          phoneNumber,
          carrier: String(carrier),
          status: result.status || 'PENDING',
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(`Withdrawal error: ${error.message}`, error.stack);
      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.withdrawalFailed',
        {
          lang,
          defaultValue: 'Failed to initiate withdrawal',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Make deposit - High-level method with validation
   */
  async makeDeposit(
    amount: number,
    phoneNumber: string,
    lang: string = 'en',
  ): Promise<MobilemoneyDepositResponseDto> {
    try {
      this.validateConfiguration(lang);

      // Validate phone number carrier
      const carrier = this.getCarrier(phoneNumber);
      if (!carrier) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.invalidPhoneNumber',
          {
            lang,
            defaultValue:
              'Invalid phone number. Must be a valid Cameroonian mobile number (MTN or Orange)',
          },
        );
        throw new BadRequestException(message);
      }

      // Get service code for the carrier (using PAIEMENTMARCHAND for deposits)
      const serviceCode = this.getServiceCode(carrier, PaymentAction.CASHIN);
      console.log('serviceCode', serviceCode);
      if (!serviceCode) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.unsupportedCarrier',
          {
            lang,
            defaultValue: 'Carrier not supported for deposit',
          },
        );
        throw new BadRequestException(message);
      }

      // Execute cashin (generates unique partnerId internally)
      const result = await this.cashin(phoneNumber, serviceCode, amount, lang);

      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.depositInitiated',
        {
          lang,
          defaultValue: 'Deposit initiated successfully',
        },
      );

      return {
        message,
        transaction: {
          transactionId: result.partnerId, // Use partnerId as transaction ID
          amount,
          phoneNumber,
          carrier: String(carrier),
          status: result.status || 'PENDING',
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(`Deposit error: ${error.message}`, error.stack);
      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.depositFailed',
        {
          lang,
          defaultValue: 'Failed to initiate deposit',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Validate that all required configuration is present
   */
  private async validateConfiguration(lang: string): Promise<void> {
    if (!this.baseUri || !this.secretKey || !this.appKey) {
      const message = await this.i18n.translate(
        'translation.payment.mobilemoney.configurationError',
        {
          lang,
          defaultValue:
            'Mobile money configuration is incomplete. Please contact support.',
        },
      );
      this.logger.error(
        'Mobile money configuration missing - Required: MOALA_URL, MOALA_API_KEY, MOALA_SECRET',
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Determine the mobile money carrier based on phone number
   * @param phone - Phone number to check
   * @returns PaymentCarrier or null if not recognized
   */
  private getCarrier(phone: string): PaymentCarrier | null {
    try {
      const cleanPhone = phone.trim();

      // Orange Cameroon: 69xxxxxxx or 655-659xxxxxx
      if (/^(69\d{7}|65[5-9]\d{6})$/.test(cleanPhone)) {
        return PaymentCarrier.ORANGE_CM;
      }

      // MTN Cameroon: 67xxxxxxx, 680-684xxxxx, or 650-654xxxxx
      if (/^(67\d{7}|68[0-4]\d{6}|65[0-4]\d{6})$/.test(cleanPhone)) {
        return PaymentCarrier.MTN_CM;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error determining carrier: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the service code for a specific carrier and action
   * @param carrier - Payment carrier (MTN, Orange, etc.)
   * @param action - Payment action (CASHOUT or PAIEMENTMARCHAND)
   * @returns Service code or undefined
   */
  private getServiceCode(
    carrier: PaymentCarrier,
    action: PaymentAction,
  ): string | undefined {
    if (action === PaymentAction.CASHIN) {
      return this.serviceCodes[`CASHIN_${carrier}_DIS`];
    }
    return this.serviceCodes[`${action}_${carrier}`];
  }
}
