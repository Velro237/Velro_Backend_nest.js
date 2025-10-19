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
   * Get Stripe instance (for advanced operations)
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}

