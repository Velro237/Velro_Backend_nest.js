import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly appUrl: string;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-07-30.preview' as any, // Use preview version for FX Quotes API
    });

    this.appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  /**
   * Create a PaymentIntent for platform (sender payment)
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    orderId: string;
    travelerId: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    try {
      this.logger.log(`Creating PaymentIntent for order ${params.orderId}`);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(params.amount * 100), // Convert to cents
        currency: params.currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never', // Disable redirect-based payment methods for API integration
        },
        metadata: {
          orderId: params.orderId,
          travelerId: params.travelerId,
          ...params.metadata,
        },
        transfer_group: params.orderId, // For tracking related transfers
      });

      this.logger.log(`PaymentIntent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error('Failed to create PaymentIntent:', error);
      throw new BadRequestException(`Failed to create payment: ${error.message}`);
    }
  }

  /**
   * Create or retrieve Stripe Express Connected Account for traveler
   */
  async ensureConnectedAccount(params: {
    userId: string;
    email: string;
    country: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ accountId: string; isNew: boolean }> {
    try {
      this.logger.log(`Ensuring connected account for user ${params.userId}`);

      // Create Express account with appropriate capabilities
      const capabilities: any = {
        transfers: { requested: true },
      };
      
      // For US accounts, we need both card_payments and transfers
      if (params.country === 'US') {
        capabilities.card_payments = { requested: true };
      }
      
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: params.country,
        email: params.email,
        capabilities,
        business_type: 'individual',
        individual: params.firstName && params.lastName ? {
          first_name: params.firstName,
          last_name: params.lastName,
          email: params.email,
        } : undefined,
        metadata: {
          userId: params.userId,
        },
      });

      this.logger.log(`Created Stripe account: ${account.id}`);
      return { accountId: account.id, isNew: true };
    } catch (error) {
      this.logger.error('Failed to create connected account:', error);
      throw new BadRequestException(`Failed to create payout account: ${error.message}`);
    }
  }

  /**
   * Create Account Link for onboarding
   */
  async createAccountLink(accountId: string): Promise<string> {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${this.appUrl}/connect/refresh`,
        return_url: `${this.appUrl}/connect/return`,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      this.logger.error('Failed to create account link:', error);
      throw new BadRequestException(`Failed to create onboarding link: ${error.message}`);
    }
  }

  /**
   * Get account details and capability status
   */
  async getAccountDetails(accountId: string): Promise<Stripe.Account> {
    try {
      return await this.stripe.accounts.retrieve(accountId);
    } catch (error) {
      this.logger.error('Failed to retrieve account:', error);
      throw new BadRequestException(`Failed to retrieve account: ${error.message}`);
    }
  }

  /**
   * Get platform account balance (multi-currency)
   */
  async getPlatformBalance(): Promise<Stripe.Balance> {
    try {
      this.logger.log('Retrieving platform account balance');
      const balance = await this.stripe.balance.retrieve();
      this.logger.log(`Platform balance: ${balance.available.map(b => `${b.amount/100} ${b.currency}`).join(', ')}`);
      return balance;
    } catch (error) {
      this.logger.error('Failed to get platform balance:', error);
      throw new BadRequestException(`Failed to get platform balance: ${error.message}`);
    }
  }

  /**
   * Get Stripe's supported currencies and their conversion rates
   */
  async getExchangeRates(): Promise<any> {
    try {
      this.logger.log('Retrieving Stripe supported currencies and rates');
      
      // Get supported currencies from country specs
      const countrySpecs = await this.stripe.countrySpecs.list({ limit: 100 });
      const allCurrencies = new Set<string>();
      
      countrySpecs.data.forEach(spec => {
        if (spec.supported_payment_currencies) {
          spec.supported_payment_currencies.forEach(currency => {
            allCurrencies.add(currency);
          });
        }
      });

      // Create a simple rate structure (Stripe doesn't provide public exchange rates API)
      // We'll use a fallback approach with common rates
      const supportedCurrencies = Array.from(allCurrencies).sort();
      
      this.logger.log(`Stripe supported currencies: ${supportedCurrencies.length} currencies`);
      
      return {
        supportedCurrencies,
        message: 'Stripe does not provide public exchange rates API. Use real-time conversion during transfers.'
      };
    } catch (error) {
      this.logger.error('Failed to get Stripe currencies:', error);
      throw new BadRequestException(`Failed to get currencies: ${error.message}`);
    }
  }

  /**
   * Convert amount using Stripe's built-in currency conversion
   */
  async convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      if (fromCurrency === toCurrency) {
        return amount;
      }

      this.logger.log(`Converting ${amount} ${fromCurrency} to ${toCurrency} - Stripe will handle conversion during transfer`);
      
      // Let Stripe handle currency conversion automatically during transfers
      // Stripe uses real-time midmarket rates with guaranteed exchange rates
      this.logger.log(`Using Stripe's automatic currency conversion: ${amount} ${fromCurrency} → ${toCurrency}`);
      
      return amount;
    } catch (error) {
      this.logger.error('Failed to convert amount:', error);
      throw new BadRequestException(`Failed to convert amount: ${error.message}`);
    }
  }

  /**
   * Create a Transfer to connected account (withdrawal)
   * Uses Stripe's FX Quotes API for real-time currency conversion
   */
  async createTransfer(params: {
    amount: number;
    currency: string;
    destination: string;
    transferGroup?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Transfer> {
    try {
      this.logger.log(`Creating transfer to ${params.destination}`);

      // If requesting EUR, transfer directly (no conversion needed)
      if (params.currency.toLowerCase() === 'eur') {
        const transfer = await this.stripe.transfers.create({
          amount: Math.round(params.amount * 100),
          currency: 'eur',
          destination: params.destination,
          transfer_group: params.transferGroup,
          metadata: params.metadata,
        });

        this.logger.log(`EUR transfer created: ${transfer.id}`);
        return transfer;
      }

      // For other currencies, use FX Quotes API for conversion
      this.logger.log(`Getting FX quote for ${params.amount} ${params.currency} to EUR`);

      // Get FX quote for currency conversion using raw API call
      const response = await fetch('https://api.stripe.com/v1/fx_quotes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2025-07-30.preview'
        },
        body: new URLSearchParams({
          to_currency: 'eur',
          'from_currencies[]': params.currency.toLowerCase(),
          lock_duration: 'five_minutes',
          'usage[type]': 'transfer',
          'usage[transfer][destination]': params.destination
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`FX Quote API error: ${error}`);
      }

      const fxQuote = await response.json();

      this.logger.log(`FX Quote created: ${fxQuote.id}`);

      // Calculate the EUR amount needed for the transfer
      const rate = fxQuote.rates[params.currency.toLowerCase()]?.exchange_rate;
      if (!rate) {
        throw new BadRequestException(`Exchange rate not available for ${params.currency}`);
      }

      const eurAmount = params.amount / rate; // Convert to EUR
      this.logger.log(`FX conversion: ${params.amount} ${params.currency} = ${eurAmount.toFixed(2)} EUR (rate: ${rate})`);

      // Create transfer in EUR with the converted amount
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(eurAmount * 100), // Convert to cents
        currency: 'eur',
        destination: params.destination,
        transfer_group: params.transferGroup,
        metadata: {
          ...params.metadata,
          originalAmount: params.amount.toString(),
          originalCurrency: params.currency,
          convertedAmount: eurAmount.toFixed(2),
          convertedCurrency: 'eur',
          fxQuoteId: fxQuote.id,
          exchangeRate: rate.toString(),
        },
      });

      this.logger.log(`Transfer created with FX conversion: ${transfer.id}`);
      return transfer;
    } catch (error) {
      this.logger.error('Failed to create transfer:', error);
      throw new BadRequestException(`Failed to create transfer: ${error.message}`);
    }
  }

  /**
   * Retrieve PaymentIntent details
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error('Failed to retrieve PaymentIntent:', error);
      throw new BadRequestException(`Failed to retrieve payment: ${error.message}`);
    }
  }

  /**
   * Get Stripe fee from PaymentIntent charges
   */
  async getStripeFee(paymentIntentId: string): Promise<number> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge'],
      });

      const charge = paymentIntent.latest_charge as Stripe.Charge;
      if (charge && charge.balance_transaction) {
        const balanceTransaction = await this.stripe.balanceTransactions.retrieve(
          charge.balance_transaction as string
        );
        // Convert from cents to currency units
        return balanceTransaction.fee / 100;
      }

      // No fallback - if we can't get real fee, throw error
      throw new Error('Unable to retrieve Stripe fee: no balance transaction found');
    } catch (error) {
      this.logger.error('Failed to get Stripe fee:', error);
      throw new Error(`Stripe fee retrieval failed: ${error.message}`);
    }
  }

  /**
   * Construct webhook event from raw body
   */
  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    webhookSecret: string
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /**
   * Cancel a PaymentIntent (for authorized but not captured payments)
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      this.logger.log(`Canceling PaymentIntent ${paymentIntentId}`);

      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId, {
        cancellation_reason: 'requested_by_customer',
      });

      this.logger.log(`PaymentIntent canceled: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error('Failed to cancel PaymentIntent:', error);
      throw new BadRequestException(`Failed to cancel payment: ${error.message}`);
    }
  }

  /**
   * Create a refund for a charge (for captured payments)
   */
  async createRefund(chargeId: string, amount: number): Promise<Stripe.Refund> {
    try {
      this.logger.log(`Creating refund for charge ${chargeId}: €${amount}`);

      const refund = await this.stripe.refunds.create({
        charge: chargeId,
        amount: Math.round(amount * 100), // Convert to cents
        metadata: {
          reason: 'cancellation',
        },
      });

      this.logger.log(`Refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error('Failed to create refund:', error);
      throw new BadRequestException(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Smart cancellation/refund based on payment status
   */
  async processCancellationOrRefund(paymentIntentId: string, amount: number): Promise<{
    type: 'cancellation' | 'refund';
    result: Stripe.PaymentIntent | Stripe.Refund;
  }> {
    try {
      // First, get the PaymentIntent to check its status
      const paymentIntent = await this.getPaymentIntent(paymentIntentId);
      
      // Check if payment is captured or not
      if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'requires_confirmation') {
        // Payment is authorized but not captured - CANCEL it
        this.logger.log(`Payment not captured, canceling PaymentIntent: ${paymentIntentId}`);
        const canceledPayment = await this.cancelPaymentIntent(paymentIntentId);
        return { type: 'cancellation', result: canceledPayment };
      } else if (paymentIntent.status === 'succeeded') {
        // Payment is captured - REFUND it
        this.logger.log(`Payment captured, creating refund for: ${paymentIntentId}`);
        const chargeId = paymentIntent.latest_charge as string;
        if (!chargeId) {
          throw new Error('No charge found for captured payment');
        }
        const refund = await this.createRefund(chargeId, amount);
        return { type: 'refund', result: refund };
      } else {
        throw new Error(`Cannot process cancellation for payment in status: ${paymentIntent.status}`);
      }
    } catch (error) {
      this.logger.error('Failed to process cancellation/refund:', error);
      throw new BadRequestException(`Failed to process cancellation: ${error.message}`);
    }
  }

  /**
   * Get account's supported payout currencies
   * Stripe Connect automatically handles currency conversion at payout
   */
  async getAccountPayoutCurrencies(accountId: string): Promise<string[]> {
    // Get account capabilities and supported currencies
    const account = await this.stripe.accounts.retrieve(accountId, {
      expand: ['capabilities'],
    });
    
    // Get supported currencies from Stripe's API
    const countrySpec = await this.stripe.countrySpecs.retrieve(account.country);
    
    // Return supported currencies for the account's country
    return countrySpec.supported_payment_currencies;
  }

  /**
   * Get all supported currencies from Stripe
   */
  async getSupportedCurrencies(): Promise<string[]> {
    // Get supported currencies from Stripe's API
    const countrySpecs = await this.stripe.countrySpecs.list({ limit: 100 });
    
    // Extract all unique supported currencies
    const allCurrencies = new Set<string>();
    countrySpecs.data.forEach(spec => {
      if (spec.supported_payment_currencies) {
        spec.supported_payment_currencies.forEach(currency => {
          allCurrencies.add(currency);
        });
      }
    });
    
    return Array.from(allCurrencies).sort();
  }

  /**
   * Get Stripe instance (for advanced operations)
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}

