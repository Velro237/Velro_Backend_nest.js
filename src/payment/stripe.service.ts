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
      apiVersion: '2025-09-30.clover',
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

      // Create Express account
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: params.country,
        email: params.email,
        capabilities: {
          transfers: { requested: true },
        },
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
   * Create a Transfer to connected account (withdrawal)
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

      const transfer = await this.stripe.transfers.create({
        amount: Math.round(params.amount * 100), // Convert to cents
        currency: params.currency.toLowerCase(),
        destination: params.destination,
        transfer_group: params.transferGroup,
        metadata: params.metadata,
      });

      this.logger.log(`Transfer created: ${transfer.id}`);
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

      // Fallback: estimate Stripe fee (2.9% + €0.30 for European cards)
      const amount = paymentIntent.amount / 100;
      return (amount * 0.029) + 0.30;
    } catch (error) {
      this.logger.error('Failed to get Stripe fee:', error);
      // Return estimated fee
      return 0;
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
   * Get Stripe instance (for advanced operations)
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}

