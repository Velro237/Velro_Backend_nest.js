import {
  BadRequestException,
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAction, PaymentCarrier } from '../entitiy/mobilemoney.entity';
import { I18nService } from 'nestjs-i18n';
import { RequestService } from '../../request/request.service';
import { CurrencyService } from '../../currency/currency.service';
import { Currency } from 'generated/prisma';
import { NotificationService } from '../../notification/notification.service';
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
    private readonly prisma: PrismaService,
    private readonly requestService: RequestService,
    private readonly currencyService: CurrencyService,
    private readonly notificationService: NotificationService,
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
      console.log('endpoint', endpoint);
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
    userId: string,
    requestId: string,
    withdrawalNumberId: string,
    lang: string = 'en',
  ): Promise<MobilemoneyCashoutResponseDto> {
    try {
      this.validateConfiguration(lang);

      // Get trip request with cost
      const request = await this.prisma.tripRequest.findUnique({
        where: { id: requestId },
        include: {
          trip: true,
          user: true,
        },
      });

      if (!request) {
        throw new BadRequestException('Trip request not found');
      }

      // Check if request status is ACCEPTED
      if (request.status !== 'ACCEPTED') {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.requestNotAccepted',
          {
            lang,
            defaultValue:
              'Request must be accepted before withdrawal can be processed',
          },
        );
        throw new BadRequestException(message);
      }

      // Check if the user making withdrawal is the request owner
      if (request.user_id !== userId) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.unauthorizedWithdrawal',
          {
            lang,
            defaultValue: 'You are not authorized to make pay for this request',
          },
        );
        throw new BadRequestException(message);
      }

      if (!request.cost) {
        throw new BadRequestException('Request cost not found');
      }

      // Use request cost as amount
      const amount = Number(request.cost);

      // Get user and wallet
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (!user.wallet) {
        throw new BadRequestException('User wallet not found');
      }

      // Check wallet state
      // if (user.wallet.state === 'BLOCKED') {
      //   throw new BadRequestException(
      //     'Wallet is blocked. Cannot process withdrawal.',
      //   );
      // }

      // Get withdrawal number
      const withdrawalNumber = await this.prisma.withdrawalNumber.findUnique({
        where: { id: withdrawalNumberId },
      });

      if (!withdrawalNumber) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.withdrawalNumberNotFound',
          {
            lang,
            defaultValue: 'Withdrawal number not found',
          },
        );
        throw new BadRequestException(message);
      }

      // Check if user owns this withdrawal number
      if (withdrawalNumber.user_id !== userId) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.unauthorizedWithdrawalNumber',
          {
            lang,
            defaultValue:
              'You do not have permission to use this withdrawal number',
          },
        );
        throw new BadRequestException(message);
      }

      // Get carrier from withdrawal number
      const carrier =
        withdrawalNumber.carrier === 'MTN'
          ? PaymentCarrier.MTN_CM
          : PaymentCarrier.ORANGE_CM;

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

      // Convert request cost to XAF using CurrencyService
      let amountInXAF = 0;
      try {
        const conv = this.currencyService.convertCurrency(
          amount,
          (request.currency as string) || 'XAF',
          'XAF',
        );
        amountInXAF = conv.convertedAmount;
      } catch (convErr) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.invalidCurrency',
          {
            lang,
            defaultValue: `Invalid currency or exchange rate not configured for ${request.currency}`,
          },
        );
        throw new BadRequestException(message);
      }

      const feePercent = this.configService.get<number>('VELRO_FEE_PERCENT', 0);
      const fixedFee = this.configService.get<number>('FIXED_FEE_XAF', 0);
      const feeApplied = (amountInXAF * feePercent) / 100;
      const totalFee = +feeApplied + +fixedFee;
      const amountPaid = +amountInXAF + +totalFee;

      // Execute cashout (generates unique partnerId internally)
      const result = await this.cashout(
        withdrawalNumber.number,
        serviceCode,
        amountPaid,
        lang,
      );

      // Create transaction record
      const transaction = await this.prisma.transaction.create({
        data: {
          userId: userId,
          wallet_id: user.wallet.id,
          trip_id: request.trip_id,
          request_id: requestId,
          type: 'DEBIT',
          source: 'TRIP_PAYMENT',
          amount_requested: amountInXAF,
          fee_applied: totalFee,
          amount_paid: amountPaid,
          currency: 'XAF',
          provider: carrier === PaymentCarrier.MTN_CM ? 'MTN' : 'ORANGE',
          reference: result.partnerId,
          phone_number: withdrawalNumber.number,
          description: `Mobile Money withdrawal for request ${requestId} to ${withdrawalNumber.number} (${withdrawalNumber.name})`,
          status: 'PENDING',
          metadata: {
            ...result,
            withdrawal_number_id: withdrawalNumberId,
            withdrawal_number: withdrawalNumber.number,
          },
          provider_id: result.partnerId,
        },
      });

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
          transactionId: transaction.id,
          amount: Number(transaction.amount_requested),
          phoneNumber: withdrawalNumber.number,
          carrier: String(carrier),
          status: transaction.status,
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
    withdrawalNumberId: string,
    userId: string,
    lang: string = 'en',
    requestId?: string,
  ): Promise<MobilemoneyDepositResponseDto> {
    try {
      this.validateConfiguration(lang);

      // If requestId is provided, check and update request currency if needed
      if (requestId) {
        const request = await this.prisma.tripRequest.findUnique({
          where: { id: requestId },
          include: {
            user: {
              select: {
                id: true,
                currency: true,
              },
            },
          },
        });

        if (request) {
          const userCurrency = (request.user.currency || 'XAF').toUpperCase();
          const requestCurrency = (request.currency || 'XAF').toUpperCase();

          // If request currency is different from user's currency, convert and update
          if (requestCurrency !== userCurrency) {
            const conversion = this.currencyService.convertCurrency(
              Number(request.cost || 0),
              requestCurrency,
              userCurrency,
            );

            // Update request with converted amount and user's currency
            await this.prisma.tripRequest.update({
              where: { id: requestId },
              data: {
                cost: conversion.convertedAmount,
                currency: userCurrency as Currency,
              },
            });

            this.logger.log(
              `Updated request ${requestId} currency from ${requestCurrency} to ${userCurrency} with converted amount ${conversion.convertedAmount}`,
            );
          }
        }
      }

      // Get withdrawal number
      const withdrawalNumber = await this.prisma.withdrawalNumber.findUnique({
        where: { id: withdrawalNumberId },
      });

      if (!withdrawalNumber) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.withdrawalNumberNotFound',
          {
            lang,
            defaultValue: 'Withdrawal number not found',
          },
        );
        throw new BadRequestException(message);
      }

      // Check if user owns this withdrawal number
      if (withdrawalNumber.user_id !== userId) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.unauthorizedWithdrawalNumber',
          {
            lang,
            defaultValue:
              'You do not have permission to use this withdrawal number',
          },
        );
        throw new BadRequestException(message);
      }

      // Get user wallet and check balance
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId: userId },
      });

      if (!wallet) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.walletNotFound',
          {
            lang,
            defaultValue: 'Wallet not found',
          },
        );
        throw new BadRequestException(message);
      }

      // Check if wallet is not blocked
      if (wallet.state === 'BLOCKED') {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.walletBlocked',
          {
            lang,
            defaultValue: 'Wallet is blocked. Cannot process deposit.',
          },
        );
        throw new BadRequestException(message);
      }

      // Check if user has enough HOLD balance in XAF (funds reserved for trip payout)
      const availableBalanceXaf = Number(wallet.available_balance_xaf);
      if (availableBalanceXaf < amount) {
        const message = await this.i18n.translate(
          'translation.payment.mobilemoney.insufficientBalance',
          {
            lang,
            defaultValue: `Insufficient avalaible balance. Available: ${availableBalanceXaf} XAF, Requested: ${amount} XAF`,
          },
        );
        throw new BadRequestException(message);
      }

      // Get carrier from withdrawal number
      const carrier =
        withdrawalNumber.carrier === 'MTN'
          ? PaymentCarrier.MTN_CM
          : PaymentCarrier.ORANGE_CM;

      // Get service code for the carrier (using PAIEMENTMARCHAND for deposits)
      const serviceCode = this.getServiceCode(carrier, PaymentAction.CASHIN);
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
      const result = await this.cashin(
        withdrawalNumber.number,
        serviceCode,
        amount,
        lang,
      );

      // Deduct amount from HOLD balances (XAF and wallet currency) and create transaction
      await this.prisma.$transaction(async (prisma) => {
        // Convert XAF to wallet currency for proper decrement on multi-currency balances
        let converted = 0;
        try {
          const conv = this.currencyService.convertCurrency(
            amount,
            'XAF',
            wallet.currency,
          );
          converted = conv.convertedAmount;
        } catch (convErr) {
          this.logger.warn(
            `Currency conversion XAF -> ${wallet.currency} failed during deposit: ${convErr?.message || convErr}`,
          );
          converted = 0;
        }

        // Update wallet balances: decrease XAF hold and corresponding wallet currency hold/total
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            available_balance_xaf: {
              decrement: amount,
            },
            ...(converted > 0
              ? {
                  available_balance: { decrement: converted },
                  total_balance: { decrement: converted },
                }
              : {}),
          },
        });

        // Create debit transaction
        await prisma.transaction.create({
          data: {
            userId: userId,
            wallet_id: wallet.id,
            type: 'DEBIT',
            source: 'WITHDRAW',
            amount_requested: amount,
            fee_applied: 0,
            amount_paid: amount,
            currency: 'XAF',
            status: 'SUCCESS',
            provider: withdrawalNumber.carrier as any,
            provider_id: result.partnerId,
            description: `Mobile money deposit to ${withdrawalNumber.number} (${withdrawalNumber.name})`,
            balance_after: availableBalanceXaf - amount,
            metadata: {
              withdrawal_number_id: withdrawalNumberId,
              withdrawal_number: withdrawalNumber.number,
              service_code: serviceCode,
              convertedAmount: converted,
              walletCurrency: wallet.currency,
            },
          },
        });
      });

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
          phoneNumber: withdrawalNumber.number,
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

  /**
   * Convert amount from any currency to XAF (Central African CFA Franc)
   * @param amount - The amount to convert
   * @param currency - The source currency code
   * @returns The amount in XAF, or null if conversion fails
   */
  async convertToXAF(amount: number, currency: string): Promise<number | null> {
    // If already in XAF, return as-is
    if (currency === 'XAF') {
      return amount;
    }

    // Get exchange rates from environment variables
    const currencyUpper = currency.toUpperCase();
    const envKey = `EXCHANGE_RATE_${currencyUpper}_TO_XAF`;
    const rateString = this.configService.get<string>(envKey);

    if (!rateString) {
      this.logger.warn(
        `Exchange rate not found for currency: ${currency}. Environment variable ${envKey} is not set.`,
      );
      return null;
    }

    const rate = parseFloat(rateString);

    if (isNaN(rate) || rate <= 0) {
      this.logger.warn(
        `Invalid exchange rate for currency: ${currency}. Value: ${rateString}`,
      );
      return null;
    }

    // Convert to XAF
    const amountInXAF = amount * rate;

    return Number(amountInXAF.toFixed(2));
  }

  /**
   * Handle mobile money payment callback
   * Updates transaction status and credits trip creator's wallet if payment is received
   */
  async handlePaymentCallback(callbackData: {
    status: string;
    amount: string;
    partnerId: string;
    operatorId: string;
    serviceCode: string;
    message: string | null;
  }): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(
        'Processing mobile money payment callback:',
        callbackData,
      );

      const { status, amount, partnerId, operatorId, serviceCode, message } =
        callbackData;

      // Find transaction by provider_id (partnerId)
      const transaction = await this.prisma.transaction.findFirst({
        where: {
          provider_id: partnerId,
          status: 'PENDING',
        },
        include: {
          trip: {
            include: {
              user: {
                include: {
                  wallet: true,
                },
              },
            },
          },
          request: true,
        },
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found for partnerId: ${partnerId}`);
        return {
          success: false,
          message: 'Transaction not found',
        };
      }

      // Update transaction status
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: status as any, // Cast to TransactionStatus enum
          status_message: message,
          processedAt: new Date(),
          metadata: {
            ...((transaction.metadata as any) || {}),
            callbackData: {
              operatorId,
              serviceCode,
              receivedAt: new Date(),
            },
          },
        },
      });

      this.logger.log(
        `Transaction ${transaction.id} status updated to: ${status}`,
      );

      // If payment is received, update request, status and credit the trip creator's wallet
      if (status === 'RECEIVED') {
        // Attach transaction to request and mark payment as succeeded
        if (transaction.request_id) {
          try {
            await this.prisma.tripRequest.update({
              where: { id: transaction.request_id },
              data: {
                payment_intent_id: transaction.id,
                payment_status: 'SUCCEEDED',
              },
            });
          } catch (updateErr) {
            this.logger.warn(
              `Failed to update request payment fields for ${transaction.request_id}: ${updateErr?.message || updateErr}`,
            );
          }
        }

        // Update request status to CONFIRMED using the request service
        if (transaction.request_id) {
          try {
            await this.requestService.changeRequestStatus(
              transaction.request_id,
              'CONFIRMED',
              transaction.userId, // Use the transaction user ID as the system user
              'en', // Default language
              true,
            );
            this.logger.log(
              `Request ${transaction.request_id} status updated to CONFIRMED`,
            );
          } catch (requestStatusError) {
            this.logger.error(
              `Failed to update request status: ${requestStatusError.message}`,
            );
            // Continue with wallet crediting even if request status update fails
          }
        }
        const tripCreator = transaction.trip?.user;

        if (!tripCreator) {
          this.logger.warn(
            `Trip creator not found for transaction: ${transaction.id}`,
          );
          return {
            success: false,
            message: 'Trip creator not found',
          };
        }

        if (!tripCreator.wallet) {
          this.logger.warn(
            `Wallet not found for trip creator: ${tripCreator.id}`,
          );
          return {
            success: false,
            message: 'Trip creator wallet not found',
          };
        }

        const netAmount = Number(transaction.amount_requested);

        // Credit trip creator's wallet (XAF hold) and converted hold in wallet currency
        // Convert XAF net amount to wallet currency
        let convertedHold = 0;
        try {
          const conv = this.currencyService.convertCurrency(
            netAmount,
            'XAF',
            tripCreator.wallet.currency,
          );
          convertedHold = conv.convertedAmount;
        } catch (convErr) {
          this.logger.warn(
            `Currency conversion XAF -> ${tripCreator.wallet.currency} failed: ${convErr?.message || convErr}`,
          );
        }

        await this.prisma.wallet.update({
          where: { id: tripCreator.wallet.id },
          data: {
            hold_balance_xaf: {
              increment: netAmount,
            },
            ...(convertedHold > 0
              ? {
                  hold_balance: { increment: convertedHold },
                  total_balance: { increment: convertedHold },
                }
              : {}),
          },
        });

        // Determine provider: prefer original transaction.provider to keep consistency
        // Fallback to serviceCode inference only if provider is missing
        let provider = (transaction as any).provider as string | undefined;
        if (!provider) {
          provider = serviceCode.includes('ORANGE') ? 'ORANGE' : 'MTN';
        }

        // Create a credit transaction for the trip creator
        const creditTransaction = await this.prisma.transaction.create({
          data: {
            userId: tripCreator.id,
            wallet_id: tripCreator.wallet.id,
            trip_id: transaction.trip_id,
            request_id: transaction.request_id,
            type: 'CREDIT',
            source: 'TRIP_EARNING',
            amount_requested: netAmount,
            fee_applied: 0,
            amount_paid: netAmount,
            currency: 'XAF',
            status: 'ONHOLD',
            provider: provider as any,
            description: `Trip payment received from ${transaction.userId}`,
            balance_after:
              Number(tripCreator.wallet.hold_balance_xaf) + netAmount,
            metadata: {
              originalTransactionId: transaction.id,
              paymentMethod: 'mobile_money',
              serviceCode,
              operatorId,
              convertedHoldAmount: convertedHold,
              walletCurrency: tripCreator.wallet.currency,
            },
          },
        });

        this.logger.log(
          `Credited ${netAmount} ${transaction.currency} to trip creator ${tripCreator.id} for transaction ${transaction.id}`,
        );

        // Send push notifications to both users
        try {
          // Get payer (user who made the payment) with language preference
          const payer = await this.prisma.user.findUnique({
            where: { id: transaction.userId },
            select: {
              id: true,
              email: true,
              name: true,
              device_id: true,
              lang: true,
            },
          });

          // Get trip creator with language preference (already have tripCreator but need lang)
          const tripCreatorWithLang = await this.prisma.user.findUnique({
            where: { id: tripCreator.id },
            select: {
              id: true,
              email: true,
              name: true,
              device_id: true,
              lang: true,
            },
          });

          // Prepare notification data
          const notificationData = {
            transaction_id: creditTransaction.id,
            request_id: transaction.request_id,
            trip_id: transaction.trip_id,
          };

          // Send notification to payer (successfully paid)
          if (payer?.device_id) {
            const payerLang = payer.lang || 'en';
            const payerTitle = await this.i18n.translate(
              'translation.notification.payment.success.title',
              {
                lang: payerLang,
                defaultValue: 'Payment Successful',
              },
            );
            const payerMessage = await this.i18n.translate(
              'translation.notification.payment.success.message',
              {
                lang: payerLang,
                defaultValue: 'Your payment has been successfully processed',
              },
            );

            await this.notificationService.sendPushNotification(
              {
                deviceId: payer.device_id,
                title: payerTitle,
                body: payerMessage,
                data: notificationData,
              },
              payerLang,
            );
          }

          // Send notification to trip creator (received payment)
          if (tripCreatorWithLang?.device_id) {
            const tripCreatorLang = tripCreatorWithLang.lang || 'en';
            const tripCreatorTitle = await this.i18n.translate(
              'translation.notification.payment.received.title',
              {
                lang: tripCreatorLang,
                defaultValue: 'Payment Received',
              },
            );
            const tripCreatorMessage = await this.i18n.translate(
              'translation.notification.payment.received.message',
              {
                lang: tripCreatorLang,
                defaultValue: 'You have received payment for your trip',
              },
            );

            await this.notificationService.sendPushNotification(
              {
                deviceId: tripCreatorWithLang.device_id,
                title: tripCreatorTitle,
                body: tripCreatorMessage,
                data: notificationData,
              },
              tripCreatorLang,
            );
          }
        } catch (notificationError) {
          this.logger.error(
            `Failed to send push notifications: ${notificationError.message}`,
          );
          // Don't fail the payment processing if notifications fail
        }
      }

      return {
        success: true,
        message: 'Callback processed successfully',
      };
    } catch (error) {
      this.logger.error('Error processing payment callback:', error);
      return {
        success: false,
        message: 'Error processing callback',
      };
    }
  }

  /**
   * Get carrier (MTN or ORANGE) from a Cameroon mobile number using regex patterns
   *
   * Patterns:
   * - ORANGE: 69xxxxxxxx or 65[5-9]xxxxxx
   * - MTN: 67xxxxxxxx or 68[0-4]xxxxxx or 65[0-4]xxxxxx
   *
   * @returns 'MTN' | 'ORANGE' | null if carrier cannot be determined
   */
  getWithdrawalCarrier(number: string): 'MTN' | 'ORANGE' | null {
    const cleanNumber = number.trim();

    if (cleanNumber.length !== 9) {
      throw new BadRequestException('Mobile number must be 9 characters');
    }

    // Check for ORANGE patterns
    if (/^(69\d{7}|65[5-9]\d{6})$/.test(cleanNumber)) {
      return 'ORANGE';
    }

    // Check for MTN patterns
    if (/^(67\d{7}|68[0-4]\d{6}|65[0-4]\d{6})$/.test(cleanNumber)) {
      return 'MTN';
    }

    // Return null if no carrier can be determined
    return null;
  }

  /**
   * Create a withdrawal number for a user
   */
  async createWithdrawalNumber(
    userId: string,
    number: string,
    name: string,
  ): Promise<{ id: string; number: string; carrier: string; name: string }> {
    const cleanNumber = number.trim().replace(/\s+/g, '');
    const cleanName = name.trim();

    // Validate number length
    if (cleanNumber.length !== 9) {
      throw new BadRequestException(
        'Mobile number must be exactly 9 characters',
      );
    }

    // Validate name
    if (!cleanName || cleanName.length === 0) {
      throw new BadRequestException('Name is required');
    }

    // Get carrier based on number
    const carrier = this.getWithdrawalCarrier(cleanNumber);

    if (!carrier) {
      throw new BadRequestException('Invalid phone number - carrier not found');
    }

    try {
      // Check if number already exists for this user
      const existingNumber = await this.prisma.withdrawalNumber.findFirst({
        where: { number: cleanNumber, user_id: userId },
      });

      if (existingNumber) {
        throw new BadRequestException(
          'This mobile number is already registered for your account',
        );
      }

      // Create withdrawal number
      const withdrawalNumber = await this.prisma.withdrawalNumber.create({
        data: {
          number: cleanNumber,
          carrier: carrier,
          name: cleanName,
          user_id: userId,
        },
        select: {
          id: true,
          number: true,
          carrier: true,
          name: true,
        },
      });

      this.logger.log(
        `Created withdrawal number ${cleanNumber} (${carrier}) for user ${userId}`,
      );

      return withdrawalNumber;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error creating withdrawal number:', error);
      throw new InternalServerErrorException(
        'Failed to create withdrawal number',
      );
    }
  }

  /**
   * Update a withdrawal number
   */
  async updateWithdrawalNumber(
    id: string,
    userId: string,
    number: string,
    name: string,
  ): Promise<{ id: string; number: string; carrier: string; name: string }> {
    const cleanNumber = number.trim().replace(/\s+/g, '');
    const cleanName = name.trim();

    // Validate number length
    if (cleanNumber.length !== 9) {
      throw new BadRequestException(
        'Mobile number must be exactly 9 characters',
      );
    }

    // Validate name
    if (!cleanName || cleanName.length === 0) {
      throw new BadRequestException('Name is required');
    }

    // Get carrier based on number
    const carrier = this.getWithdrawalCarrier(cleanNumber);

    if (!carrier) {
      throw new BadRequestException('Invalid phone number - carrier not found');
    }

    try {
      // Find the withdrawal number
      const existingNumber = await this.prisma.withdrawalNumber.findUnique({
        where: { id },
      });

      if (!existingNumber) {
        throw new BadRequestException('Withdrawal number not found');
      }

      // Check if user owns this number
      if (existingNumber.user_id !== userId) {
        throw new BadRequestException(
          'You do not have permission to update this number',
        );
      }

      // Check if new number already exists for this user (and is not the same as current)
      if (cleanNumber !== existingNumber.number) {
        const duplicateNumber = await this.prisma.withdrawalNumber.findFirst({
          where: { number: cleanNumber, user_id: userId },
        });

        if (duplicateNumber) {
          throw new BadRequestException(
            'This mobile number is already registered for your account',
          );
        }
      }

      // Update withdrawal number
      const updatedNumber = await this.prisma.withdrawalNumber.update({
        where: { id },
        data: {
          number: cleanNumber,
          carrier: carrier,
          name: cleanName,
        },
        select: {
          id: true,
          number: true,
          carrier: true,
          name: true,
        },
      });

      this.logger.log(
        `Updated withdrawal number ${id} to ${cleanNumber} (${carrier})`,
      );

      return updatedNumber;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error updating withdrawal number:', error);
      throw new InternalServerErrorException(
        'Failed to update withdrawal number',
      );
    }
  }

  /**
   * Delete a withdrawal number
   */
  async deleteWithdrawalNumber(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find the withdrawal number
      const existingNumber = await this.prisma.withdrawalNumber.findUnique({
        where: { id },
      });

      if (!existingNumber) {
        throw new BadRequestException('Withdrawal number not found');
      }

      // Check if user owns this number
      if (existingNumber.user_id !== userId) {
        throw new BadRequestException(
          'You do not have permission to delete this number',
        );
      }

      // Delete withdrawal number
      await this.prisma.withdrawalNumber.delete({
        where: { id },
      });

      this.logger.log(`Deleted withdrawal number ${id} for user ${userId}`);

      return {
        success: true,
        message: 'Withdrawal number deleted successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error deleting withdrawal number:', error);
      throw new InternalServerErrorException(
        'Failed to delete withdrawal number',
      );
    }
  }

  /**
   * Get all withdrawal numbers for a user
   */
  async getUserWithdrawalNumbers(
    userId: string,
    carrier?: 'MTN' | 'ORANGE' | 'ALL',
  ): Promise<
    Array<{ id: string; number: string; carrier: string; name: string }>
  > {
    try {
      // Build where clause with optional carrier filter
      const whereClause: any = { user_id: userId };

      // Filter by carrier if provided and not 'ALL'
      if (carrier && carrier !== 'ALL') {
        whereClause.carrier = carrier;
      }

      const withdrawalNumbers = await this.prisma.withdrawalNumber.findMany({
        where: whereClause,
        select: {
          id: true,
          number: true,
          carrier: true,
          name: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return withdrawalNumbers;
    } catch (error) {
      this.logger.error('Error getting withdrawal numbers:', error);
      throw new InternalServerErrorException(
        'Failed to get withdrawal numbers',
      );
    }
  }
}
