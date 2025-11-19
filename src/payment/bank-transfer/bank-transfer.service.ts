import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../stripe.service';
import { CurrencyService } from '../../currency/currency.service';
import Stripe from 'stripe';
import { PaymentStatus } from 'generated/prisma';
import {
  BankTransferInitResponseDto,
  FundingInstructionsResponseDto,
} from './dto/bank-transfer.dto';

type BankTransferType = Stripe.PaymentIntentCreateParams.PaymentMethodOptions.CustomerBalance.BankTransfer.Type;

@Injectable()
export class BankTransferService {
  private readonly logger = new Logger(BankTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly currencyService: CurrencyService,
    private readonly configService: ConfigService,
  ) {}

  async initBankTransferPayment(
    orderId: string,
    senderId: string,
  ): Promise<BankTransferInitResponseDto> {
    try {
      this.logger.log(`Initializing bank transfer payment for order ${orderId}`);

      const order = await this.prisma.tripRequest.findUnique({
        where: { id: orderId },
        include: {
          trip: {
            include: {
              user: true,
            },
          },
          user: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.user_id !== senderId) {
        throw new ForbiddenException('You can only pay for your own orders');
      }

      // Re-use existing PaymentIntent if it already exists
      if (order.payment_intent_id) {
        const existingIntent = await this.stripeService.getPaymentIntent(
          order.payment_intent_id,
        );

        if (!existingIntent.payment_method_types.includes('customer_balance')) {
          throw new BadRequestException(
            'Existing payment for this order is not a bank transfer payment',
          );
        }

        const customerId = existingIntent.customer as string;
        if (!customerId) {
          throw new BadRequestException(
            'Existing bank transfer payment does not have a customer associated',
          );
        }

        const fundingInstructions = await this.retrieveFundingInstructions(
          customerId,
          existingIntent.currency.toUpperCase(),
        );

        const ephemeralKey = await this.stripeService.createEphemeralKey(
          customerId,
        );

        return {
          clientSecret: existingIntent.client_secret,
          paymentIntentId: existingIntent.id,
          amount: existingIntent.amount / 100,
          currency: existingIntent.currency.toUpperCase(),
          customerId,
          ephemeralKeySecret: ephemeralKey.secret,
          fundingInstructions,
        };
      }

      const {
        travelerPrice,
        currency,
        platformFee,
        senderTotal,
        requestCurrency,
        requestCost,
        travelerId,
      } = await this.calculateBankTransferAmounts(order);

      const stripe = this.stripeService.getStripeInstance();

      // Create or retrieve customer
      let customer: Stripe.Customer;
      try {
        const existingCustomers = await stripe.customers.list({
          email: order.user.email,
          limit: 1,
        });

        if (existingCustomers.data.length > 0) {
          customer = existingCustomers.data[0];
          this.logger.log(`Using existing customer: ${customer.id}`);
        } else {
          customer = await this.stripeService.createCustomer({
            email: order.user.email,
            name: order.user.name || undefined,
            metadata: {
              userId: senderId,
              userRole: order.user.role,
            },
          });
        }
      } catch (error) {
        this.logger.error('Failed to create/get customer for bank transfer:', error);
        throw new BadRequestException('Failed to create customer for bank transfer');
      }

      const bankTransferType = this.getBankTransferType(currency);
      const bankTransferOptions = this.buildBankTransferOptions(currency);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(senderTotal * 100),
        currency: currency.toLowerCase(),
        customer: customer.id,
        payment_method_types: ['customer_balance'],
        payment_method_options: {
          customer_balance: {
            funding_type: 'bank_transfer',
            bank_transfer: {
              type: bankTransferType,
              ...bankTransferOptions,
            },
          },
        },
        metadata: {
          orderId,
          travelerId,
          travelerPrice: travelerPrice.toFixed(2),
          platformFee: platformFee.toFixed(2),
          senderTotal: senderTotal.toFixed(2),
          ...(requestCurrency !== currency
            ? {
                requestCurrency,
                requestAmount: requestCost.toFixed(2),
                paymentCurrency: currency,
                paymentAmount: senderTotal.toFixed(2),
              }
            : {}),
          paymentMethod: 'bank_transfer',
        },
        transfer_group: orderId,
      });

      await this.prisma.tripRequest.update({
        where: { id: orderId },
        data: {
          payment_intent_id: paymentIntent.id,
          payment_status: PaymentStatus.PROCESSING,
        },
      });

      const ephemeralKey = await this.stripeService.createEphemeralKey(
        customer.id,
      );

      const fundingInstructions = await this.retrieveFundingInstructions(
        customer.id,
        currency,
      );

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: senderTotal,
        currency,
        customerId: customer.id,
        ephemeralKeySecret: ephemeralKey.secret,
        fundingInstructions,
      };
    } catch (error) {
      this.logger.error('Failed to initialize bank transfer payment:', error);
      throw error;
    }
  }

  private async calculateBankTransferAmounts(order: any) {
    const tripCurrency = (order.trip.currency || 'EUR').toUpperCase();
    const requestCurrency = (order.currency || 'XAF').toUpperCase();
    const travelerId = order.trip.user_id;

    const requestCost = Number(order.cost || 0);
    if (requestCost <= 0) {
      throw new BadRequestException('Invalid order price');
    }

    let travelerPrice: number;
    let currency: string;

    if (requestCurrency === 'XAF' && tripCurrency !== 'XAF') {
      const conversion = this.currencyService.convertCurrency(
        requestCost,
        'XAF',
        tripCurrency,
      );
      travelerPrice = conversion.convertedAmount;
      currency = tripCurrency;

      this.logger.log(
        `Bank transfer conversion: ${requestCost} ${requestCurrency} = ${travelerPrice} ${currency}`,
      );
    } else if (requestCurrency !== 'XAF') {
      travelerPrice = requestCost;
      currency = requestCurrency;
    } else {
      const conversion = this.currencyService.convertCurrency(
        requestCost,
        'XAF',
        'EUR',
      );
      travelerPrice = conversion.convertedAmount;
      currency = 'EUR';

      this.logger.log(
        `Bank transfer conversion (XAF→EUR): ${requestCost} XAF = ${travelerPrice} EUR`,
      );
    }

    const platformFee = this.calculatePlatformCommission(travelerPrice);
    const senderTotal = travelerPrice + platformFee;

    return {
      travelerPrice,
      currency,
      platformFee,
      senderTotal,
      requestCurrency,
      requestCost,
      travelerId,
    };
  }

  private calculatePlatformCommission(grossAmount: number): number {
    const feePercent = Number(
      this.configService.get<number>('VELRO_FEE_PERCENT'),
    );
    const feeFixed = Number(this.configService.get<number>('VELRO_FEE_FIXED'));
    const feeMin = Number(this.configService.get<number>('VELRO_FEE_MIN'));

    let commission = (grossAmount * feePercent) / 100 + feeFixed;
    commission = Math.max(commission, feeMin);

    return Math.round(commission * 100) / 100;
  }

  private mapFundingInstructions(
    fundingInstructions: Stripe.FundingInstructions,
  ): FundingInstructionsResponseDto {
    const fi: any = fundingInstructions;
    const bankTransfer = fi.bank_transfer ?? {};
    const financialAddress = bankTransfer.financial_addresses?.[0] ?? {};
    const iban = financialAddress.iban ?? {};

    return {
      bankAccount: {
        account_number: iban.account_number,
        routing_number: iban.routing_number,
        sort_code: iban.sort_code,
        iban: iban.iban,
        bic: iban.bic,
        account_holder_name: iban.account_holder_name,
      },
      currency: fi.currency,
      type:
        bankTransfer.type ??
        financialAddress.type ??
        'bank_transfer',
      reference: bankTransfer.reference,
    };
  }

  private buildBankTransferOptions(currency: string): Record<string, unknown> {
    const type = this.getBankTransferType(currency);

    if (type === 'eu_bank_transfer') {
      return {
        eu_bank_transfer: {
          country: this.getCountryFromCurrency(currency),
        },
      };
    }

    return {};
  }

  /**
   * Get funding instructions for a customer
   * Returns the virtual bank account details
   */
  async retrieveFundingInstructions(
    customerId: string,
    currency: string,
  ): Promise<FundingInstructionsResponseDto> {
    try {
      this.logger.log(
        `Retrieving funding instructions for customer ${customerId} in ${currency}`,
      );

      const stripe = this.stripeService.getStripeInstance();

      // Determine bank transfer type based on currency
      const bankTransferType = this.getBankTransferType(currency);

      // Build bank transfer configuration based on type
      const bankTransferConfig: any = {
        type: bankTransferType,
      };

      // Add currency-specific configuration
      if (bankTransferType === 'eu_bank_transfer') {
        bankTransferConfig.eu_bank_transfer = {
          country: this.getCountryFromCurrency(currency),
        };
      } else if (bankTransferType === 'gb_bank_transfer') {
        // GBP bank transfer doesn't need additional config
      } else if (bankTransferType === 'us_bank_transfer') {
        // USD bank transfer doesn't need additional config
      } else if (bankTransferType === 'jp_bank_transfer') {
        // JPY bank transfer doesn't need additional config
      } else if (bankTransferType === 'mx_bank_transfer') {
        // MXN bank transfer doesn't need additional config
      }

      // Get funding instructions from Stripe
      const fundingInstructions = await stripe.customers.createFundingInstructions(
        customerId,
        {
          bank_transfer: bankTransferConfig,
          currency: currency.toLowerCase(),
          funding_type: 'bank_transfer',
        },
      );

      this.logger.log(
        `Funding instructions retrieved for customer ${customerId}`,
      );
      return this.mapFundingInstructions(fundingInstructions);
    } catch (error) {
      this.logger.error('Failed to retrieve funding instructions:', error);
      throw new BadRequestException(
        `Failed to retrieve funding instructions: ${error.message}`,
      );
    }
  }

  /**
   * Reconcile a payment from customer balance
   * This applies funds from customer balance to a PaymentIntent
   */
  async reconcilePaymentFromBalance(
    paymentIntentId: string,
    amount?: number,
  ): Promise<Stripe.PaymentIntent> {
    try {
      this.logger.log(
        `Reconciling payment ${paymentIntentId} from customer balance`,
      );

      const stripe = this.stripeService.getStripeInstance();

      // Get the PaymentIntent
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
      );

      if (!paymentIntent) {
        throw new NotFoundException('PaymentIntent not found');
      }

      // Get customer ID from PaymentIntent metadata or customer
      const customerId =
        (paymentIntent.customer as string) ||
        paymentIntent.metadata?.customerId;

      if (!customerId) {
        throw new BadRequestException(
          'PaymentIntent must have a customer to reconcile from balance',
        );
      }

      // Get customer's cash balance
      const cashBalance = await stripe.customers.retrieveCashBalance(customerId);

      // Check if customer has sufficient balance
      const currencyKey = paymentIntent.currency.toLowerCase();
      const availableBalance =
        (cashBalance.available as any)?.[currencyKey] || 0;
      const requiredAmount = amount
        ? Math.round(amount * 100)
        : paymentIntent.amount;

      if (availableBalance < requiredAmount) {
        throw new BadRequestException(
          `Insufficient customer balance. Available: ${availableBalance / 100} ${paymentIntent.currency.toUpperCase()}, Required: ${requiredAmount / 100} ${paymentIntent.currency.toUpperCase()}`,
        );
      }

      // Confirm the PaymentIntent using customer balance
      const confirmedPaymentIntent = await stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method_data: {
            type: 'customer_balance',
          },
        },
      );

      this.logger.log(
        `Payment reconciled from customer balance: ${paymentIntentId}`,
      );
      return confirmedPaymentIntent;
    } catch (error) {
      this.logger.error('Failed to reconcile payment from balance:', error);
      throw new BadRequestException(
        `Failed to reconcile payment: ${error.message}`,
      );
    }
  }

  /**
   * Get customer balance for a customer
   */
  async getCustomerBalance(
    customerId: string,
  ): Promise<any> {
    try {
      const stripe = this.stripeService.getStripeInstance();

      const cashBalance = await stripe.customers.retrieveCashBalance(customerId);

      return cashBalance;
    } catch (error) {
      this.logger.error('Failed to get customer balance:', error);
      throw new BadRequestException(
        `Failed to get customer balance: ${error.message}`,
      );
    }
  }

  /**
   * List customer balance transactions
   */
  async listCustomerBalanceTransactions(
    customerId: string,
    limit: number = 10,
  ): Promise<Stripe.CustomerCashBalanceTransaction[]> {
    try {
      const stripe = this.stripeService.getStripeInstance();

      const transactions = await stripe.customers.listCashBalanceTransactions(
        customerId,
        {
          limit,
        },
      );

      return transactions.data;
    } catch (error) {
      this.logger.error('Failed to list customer balance transactions:', error);
      throw new BadRequestException(
        `Failed to list transactions: ${error.message}`,
      );
    }
  }

  /**
   * Handle customer balance transaction created webhook
   * This is called when funds are received in customer balance
   */
  async handleCustomerBalanceTransactionCreated(
    transaction: Stripe.CustomerCashBalanceTransaction,
  ): Promise<void> {
    try {
      this.logger.log(
        `Customer balance transaction created: ${transaction.id}`,
      );

      const transactionType = transaction.type as unknown as string;
      if (transactionType === 'funding') {
        this.logger.log(
          `Funding received: ${transaction.net_amount / 100} ${transaction.currency.toUpperCase()} for customer ${transaction.customer}`,
        );

        // AUTO-RECONCILE: Find pending PaymentIntent for this customer and reconcile
        const customerId = transaction.customer as string;
        const currency = transaction.currency.toLowerCase();
        const amountReceived = transaction.net_amount / 100; // Convert from cents

        this.logger.log(
          `Attempting to auto-reconcile payment for customer ${customerId}`,
        );

        // Find pending PaymentIntent for this customer
        const stripe = this.stripeService.getStripeInstance();
        
        // Search for incomplete PaymentIntents for this customer
        const paymentIntents = await stripe.paymentIntents.list({
          customer: customerId,
          limit: 10,
        });

        // Find a matching PaymentIntent (same currency, requires_action status)
        const matchingIntent = paymentIntents.data.find(
          (pi) =>
            pi.currency === currency &&
            pi.status === 'requires_action' &&
            pi.amount <= transaction.net_amount, // Customer has enough balance
        );

        if (matchingIntent) {
          this.logger.log(
            `Found matching PaymentIntent ${matchingIntent.id}, reconciling...`,
          );

          // Reconcile the payment automatically
          await this.reconcilePaymentFromBalance(matchingIntent.id);

          this.logger.log(
            `Successfully auto-reconciled payment ${matchingIntent.id}`,
          );
        } else {
          this.logger.log(
            `No matching PaymentIntent found for customer ${customerId}. User may need to manually reconcile.`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to handle customer balance transaction created:',
        error,
      );
      // Don't throw - webhook handlers should be resilient
    }
  }

  /**
   * Helper: Get country code from currency
   */
  private getCountryFromCurrency(currency: string): string {
    const currencyToCountry: Record<string, string> = {
      eur: 'FR', // Default to France for EUR, can be adjusted
      gbp: 'GB',
      usd: 'US',
      jpy: 'JP',
      mxn: 'MX',
      cad: 'CA',
    };

    return currencyToCountry[currency.toLowerCase()] || 'US';
  }

  /**
   * Helper: Get bank transfer type from currency
   */
  getBankTransferType(currency: string): BankTransferType {
    const currencyToType: Record<string, BankTransferType> = {
      eur: 'eu_bank_transfer',
      gbp: 'gb_bank_transfer',
      usd: 'us_bank_transfer',
      jpy: 'jp_bank_transfer',
      mxn: 'mx_bank_transfer',
      cad: 'us_bank_transfer', // CAD uses US bank transfer type
    };

    return currencyToType[currency.toLowerCase()] || 'us_bank_transfer';
  }
}

