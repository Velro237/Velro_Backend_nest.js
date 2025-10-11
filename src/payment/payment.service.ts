import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { I18nService } from 'nestjs-i18n';
import { CreatePaymentIntentDto, PaymentIntentResponseDto } from './dto/create-payment-intent.dto';
import { ConnectOnboardingDto, ConnectOnboardingResponseDto, ConnectStatusResponseDto } from './dto/connect-onboarding.dto';
import { InitializeWalletRequestDto } from './dto/initialize-wallet-request.dto';
import { InitializeWalletResponseDto } from './dto/initialize-wallet.dto';
import {
  GetWalletRequestDto,
  GetWalletResponseDto,
} from './dto/get-wallet-request.dto';
import { PaymentStatus } from 'generated/prisma';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  async initializeWallet(
    userId: string,
    initializeWalletDto: InitializeWalletRequestDto,
    lang: string = 'en',
  ): Promise<InitializeWalletResponseDto> {
    try {
      const { currency } = initializeWalletDto;

      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        const message = await this.i18n.translate(
          'translation.payment.wallet.userNotFound',
          {
            lang,
            defaultValue: 'User not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Check if wallet already exists for this user
      const existingWallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (existingWallet) {
        const message = await this.i18n.translate(
          'translation.payment.wallet.alreadyExists',
          {
            lang,
            defaultValue: 'User already has a wallet',
          },
        );
        throw new ConflictException(message);
      }

      // Create wallet with provided or default currency
      const wallet = await this.prisma.wallet.create({
        data: {
          userId,
          available_balance_stripe: 0,
          pending_balance_stripe: 0,
          withdrawn_total_stripe: 0,
          available_balance: 0.0,
          hold_balance: 0.0,
          total_balance: 0.0,
          state: 'BLOCKED',
          currency,
        },
      });

      const message = await this.i18n.translate(
        'translation.payment.wallet.initialized',
        {
          lang,
          defaultValue: 'Wallet initialized successfully',
        },
      );

      return {
        message,
        wallet: {
          id: wallet.id,
          userId: wallet.userId,
          available_balance: Number(wallet.available_balance),
          hold_balance: Number(wallet.hold_balance),
          total_balance: Number(wallet.total_balance),
          state: wallet.state,
          currency: wallet.currency,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.payment.wallet.initializeFailed',
        {
          lang,
          defaultValue: 'Failed to initialize wallet',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getWallet(
    getWalletDto: GetWalletRequestDto,
    lang: string = 'en',
  ): Promise<GetWalletResponseDto> {
    try {
      const { walletId, userId } = getWalletDto;

      // Validate that either walletId or userId is provided, but not both
      if (!walletId && !userId) {
        throw new BadRequestException(
          'Either walletId or userId must be provided',
        );
      }

      if (walletId && userId) {
        throw new BadRequestException(
          'Provide either walletId or userId, not both',
        );
      }

      // Build where clause based on provided parameter
      const whereClause: any = walletId ? { id: walletId } : { userId };

      const wallet = await this.prisma.wallet.findUnique({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              picture: true,
              role: true,
            },
          },
        },
      });

      if (!wallet) {
        const message = await this.i18n.translate(
          'translation.payment.wallet.notFound',
          {
            lang,
            defaultValue: 'Wallet not found',
          },
        );
        throw new NotFoundException(message);
      }

      const message = await this.i18n.translate(
        'translation.payment.wallet.retrieved',
        {
          lang,
          defaultValue: 'Wallet retrieved successfully',
        },
      );

      return {
        message,
        wallet: {
          id: wallet.id,
          userId: wallet.userId,
          available_balance: Number(wallet.available_balance),
          hold_balance: Number(wallet.hold_balance),
          total_balance: Number(wallet.total_balance),
          state: wallet.state,
          currency: wallet.currency,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
          user: wallet.user,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.payment.wallet.getFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve wallet',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // ============================================
  // Stripe Payment Methods
  // ============================================

  /**
   * Create a PaymentIntent for sender to pay for order
   */
  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
    senderId: string,
  ): Promise<PaymentIntentResponseDto> {
    try {
      this.logger.log(`Creating payment for order ${dto.orderId} by sender ${senderId}`);

      // Verify order exists and is valid
      const order = await this.prisma.tripRequest.findUnique({
        where: { id: dto.orderId },
        include: {
          trip: {
            include: {
              user: true, // Traveler
            },
          },
          user: true, // Sender
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Verify sender owns this order
      if (order.user_id !== senderId) {
        throw new BadRequestException('You can only pay for your own orders');
      }

      // Check if payment already exists
      if (order.payment_intent_id) {
        // Retrieve existing payment intent
        const existingIntent = await this.stripeService.getPaymentIntent(order.payment_intent_id);
        
        if (existingIntent.status === 'succeeded') {
          throw new BadRequestException('This order has already been paid');
        }

        // Return existing intent if still pending
        return {
          clientSecret: existingIntent.client_secret,
          paymentIntentId: existingIntent.id,
          amount: existingIntent.amount / 100,
          currency: existingIntent.currency.toUpperCase(),
        };
      }

      // Create new PaymentIntent
      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: dto.amount,
        currency: dto.currency || 'EUR',
        orderId: dto.orderId,
        travelerId: dto.travelerId,
        metadata: {
          senderId,
          travelerId: dto.travelerId,
        },
      });

      // Update order with payment information
      await this.prisma.tripRequest.update({
        where: { id: dto.orderId },
        data: {
          payment_intent_id: paymentIntent.id,
          currency: dto.currency || 'EUR',
          payment_status: PaymentStatus.PROCESSING,
        },
      });

      this.logger.log(`PaymentIntent created successfully: ${paymentIntent.id}`);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: dto.amount,
        currency: dto.currency || 'EUR',
      };
    } catch (error) {
      this.logger.error('Failed to create payment intent:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment (called by webhook)
   */
  async handlePaymentSuccess(paymentIntentId: string): Promise<void> {
    try {
      this.logger.log(`Handling successful payment: ${paymentIntentId}`);

      // Find order by payment intent
      const order = await this.prisma.tripRequest.findUnique({
        where: { payment_intent_id: paymentIntentId },
        include: {
          trip: {
            include: {
              user: true, // Traveler
            },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Order not found for PaymentIntent: ${paymentIntentId}`);
        return;
      }

      // Update order status
      await this.prisma.tripRequest.update({
        where: { id: order.id },
        data: {
          payment_status: PaymentStatus.SUCCEEDED,
          paid_at: new Date(),
          status: 'APPROVED', // Automatically approve paid orders
        },
      });

      // Get or create wallet for traveler
      const wallet = await this.ensureWallet(order.trip.user_id);

      // Client spec: Traveler receives EXACTLY their set price
      // Sender pays: travelerPrice + platformFee
      // Platform keeps the fee (Stripe fee comes out of platform's share)
      const travelerPrice = Number(order.cost || 0);
      const pendingEarnings = travelerPrice;

      // Log the breakdown for tracking
      const stripeFee = await this.stripeService.getStripeFee(paymentIntentId);
      const platformCommission = this.calculatePlatformCommission(travelerPrice);
      
      this.logger.log(`Payment breakdown - Traveler gets: €${travelerPrice}, Platform fee: €${platformCommission}, Stripe fee: €${stripeFee}`);

      // Validate earnings
      if (isNaN(pendingEarnings) || pendingEarnings <= 0) {
        throw new Error(`Invalid traveler price: ${pendingEarnings}`);
      }

      // Add to pending balance
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          pending_balance_stripe: {
            increment: Number(pendingEarnings),
          },
        },
      });

      // Create transaction record
      await this.prisma.transaction.create({
        data: {
          userId: order.trip.user_id,
          wallet_id: wallet.id,
          type: 'CREDIT',
          source: 'ORDER',
          amount_requested: travelerPrice,
          fee_applied: stripeFee + platformCommission,
          amount_paid: pendingEarnings,
          currency: order.currency || 'EUR',
          request_id: order.id,
          status: 'ONHOLD',
          provider: 'STRIPE',
          description: `Earnings from order ${order.id} (pending delivery)`,
          balance_after: Number(wallet.pending_balance_stripe) + pendingEarnings,
          metadata: {
            orderId: order.id,
            stripeFee,
            platformCommission,
          },
        },
      });

      this.logger.log(`Payment processed successfully for order ${order.id}`);
    } catch (error) {
      this.logger.error('Failed to handle payment success:', error);
      throw error;
    }
  }

  /**
   * Ensure traveler has a Stripe Connected Account and start onboarding
   */
  async onboardTraveler(
    userId: string,
    dto: ConnectOnboardingDto,
  ): Promise<ConnectOnboardingResponseDto> {
    try {
      this.logger.log(`Starting onboarding for user ${userId}`);

      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      let accountId: string;
      let isNewAccount: boolean;

      // Check if user already has a Stripe account
      if (user.stripe_account_id) {
        accountId = user.stripe_account_id;
        isNewAccount = false;
        this.logger.log(`User already has Stripe account: ${accountId}`);
      } else {
        // Create new Express account
        const result = await this.stripeService.ensureConnectedAccount({
          userId: user.id,
          email: user.email,
          country: dto.country || 'FR',
          firstName: user.name?.split(' ')[0],
          lastName: user.name?.split(' ').slice(1).join(' '),
        });

        accountId = result.accountId;
        isNewAccount = result.isNew;

        // Save account ID to user
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            stripe_account_id: accountId,
            payout_country: dto.country || 'FR',
          },
        });
      }

      // Create onboarding link
      const onboardingUrl = await this.stripeService.createAccountLink(accountId);

      return {
        onboardingUrl,
        accountId,
        isNewAccount,
      };
    } catch (error) {
      this.logger.error('Failed to onboard traveler:', error);
      throw error;
    }
  }

  /**
   * Get traveler's Stripe Connect status
   */
  async getConnectStatus(userId: string): Promise<ConnectStatusResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.stripe_account_id) {
        return {
          isComplete: false,
          transfersCapability: 'inactive',
          canWithdraw: false,
        };
      }

      // Get account details from Stripe
      const account = await this.stripeService.getAccountDetails(user.stripe_account_id);

      const transfersCapability = account.capabilities?.transfers || 'inactive';
      const isComplete = transfersCapability === 'active';

      // Update local database
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          transfers_capability: transfersCapability,
          stripe_onboarding_complete: isComplete,
        },
      });

      return {
        isComplete,
        transfersCapability,
        canWithdraw: isComplete,
        accountId: user.stripe_account_id,
      };
    } catch (error) {
      this.logger.error('Failed to get connect status:', error);
      throw error;
    }
  }

  /**
   * Calculate payment breakdown for frontend
   * Client spec: Sender pays traveler price + platform fee
   */
  async calculatePaymentBreakdown(travelerPrice: number, currency: string = 'EUR'): Promise<any> {
    const platformFee = this.calculatePlatformCommission(travelerPrice);
    const senderTotal = travelerPrice + platformFee;

    const feePercent = Number(this.configService.get<number>('VELRO_FEE_PERCENT'));
    const feeFixed = Number(this.configService.get<number>('VELRO_FEE_FIXED'));
    const feeMin = Number(this.configService.get<number>('VELRO_FEE_MIN'));

    return {
      travelerPrice: Math.round(travelerPrice * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      senderTotal: Math.round(senderTotal * 100) / 100,
      currency,
      breakdown: {
        feePercent,
        feeFixed,
        feeMin,
      },
    };
  }

  /**
   * Calculate platform commission
   */
  private calculatePlatformCommission(grossAmount: number): number {
    // Client spec: 7% + €1.00 (minimum €1.99)
    const feePercent = Number(this.configService.get<number>('VELRO_FEE_PERCENT'));
    const feeFixed = Number(this.configService.get<number>('VELRO_FEE_FIXED'));
    const feeMin = Number(this.configService.get<number>('VELRO_FEE_MIN'));
    const feeMax = Number(this.configService.get<number>('VELRO_FEE_MAX'));

    let commission = (grossAmount * feePercent / 100) + feeFixed;
    commission = Math.max(commission, feeMin);
    commission = Math.min(commission, feeMax);

    return Math.round(commission * 100) / 100; // Round to 2 decimals
  }

  /**
   * Ensure wallet exists for user
   */
  private async ensureWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          available_balance_stripe: 0,
          pending_balance_stripe: 0,
          withdrawn_total_stripe: 0,
          available_balance: 0,
          hold_balance: 0,
          total_balance: 0,
          state: 'BLOCKED',
          currency: 'EUR',
        },
      });
    }

    return wallet;
  }
}
