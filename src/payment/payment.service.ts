import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { I18nService } from 'nestjs-i18n';
import {
  CreatePaymentIntentDto,
  PaymentIntentResponseDto,
} from './dto/create-payment-intent.dto';
import {
  ConnectOnboardingDto,
  ConnectOnboardingResponseDto,
  ConnectStatusResponseDto,
} from './dto/connect-onboarding.dto';
import { InitializeWalletRequestDto } from './dto/initialize-wallet-request.dto';
import { InitializeWalletResponseDto } from './dto/initialize-wallet.dto';
import {
  GetWalletRequestDto,
  GetWalletResponseDto,
} from './dto/get-wallet-request.dto';
import { PaymentStatus } from 'generated/prisma';
import { RequestService } from '../request/request.service';
import { CurrencyService } from '../currency/currency.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private stripeService: StripeService,
    private configService: ConfigService,
    @Inject(forwardRef(() => RequestService))
    private readonly requestService: RequestService,
    private readonly currencyService: CurrencyService,
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
          // Initialize currency-specific balances to 0
          available_balance_eur: 0,
          available_balance_usd: 0,
          available_balance_cad: 0,
          available_balance_xaf: 0,
          hold_balance_eur: 0,
          hold_balance_usd: 0,
          hold_balance_cad: 0,
          hold_balance_xaf: 0,
          // Keep aggregate fields for backward compatibility
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
      this.logger.log(
        `Creating payment for order ${dto.orderId} by sender ${senderId}`,
      );

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
        const existingIntent = await this.stripeService.getPaymentIntent(
          order.payment_intent_id,
        );

        if (existingIntent.status === 'succeeded') {
          throw new BadRequestException('This order has already been paid');
        }

        // Return existing intent if still pending
        // For existing intents, we need to create customer and ephemeral key too
        let customer;
        try {
          // Try to find existing customer by email
          const existingCustomers = await this.stripeService.getStripeInstance().customers.list({
            email: order.user.email,
            limit: 1,
          });
          
          if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
            this.logger.log(`Using existing customer: ${customer.id}`);
          } else {
            // Create new customer
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
          this.logger.error('Failed to create/get customer for existing intent:', error);
          throw new BadRequestException('Failed to create customer for payment');
        }

        // Create ephemeral key for the customer
        let ephemeralKey;
        try {
          ephemeralKey = await this.stripeService.createEphemeralKey(customer.id);
        } catch (error) {
          this.logger.error('Failed to create ephemeral key for existing intent:', error);
          throw new BadRequestException('Failed to create ephemeral key for payment');
        }

        return {
          clientSecret: existingIntent.id,
          paymentIntentId: existingIntent.client_secret,
          amount: existingIntent.amount / 100,
          currency: existingIntent.currency.toUpperCase(),
          ephemeralKeySecret: ephemeralKey.secret,
          customerId: customer.id,
        };
      }

      // SECURITY: Calculate amount from order (backend is source of truth)
      // Get traveler price from order
      const travelerPrice = Number(order.cost || 0);
      if (travelerPrice <= 0) {
        throw new BadRequestException('Invalid order price');
      }

      // Calculate platform fee (client spec: 7% + €1, min €1.99)
      const platformFee = this.calculatePlatformCommission(travelerPrice);

      // Calculate total sender pays
      const senderTotal = travelerPrice + platformFee;

      // Get traveler ID from order
      const travelerId = order.trip.user_id;

      // Get currency from order (supports multiple currencies)
      let currency = order.currency || 'EUR';
      
      // Handle XAF conversion - convert to Stripe-supported currency
      if (currency.toUpperCase() === 'XAF') {
        // Convert XAF to EUR for Stripe processing
        const conversion = this.currencyService.convertCurrency(
          senderTotal,
          'XAF',
          'EUR'
        );
        
        this.logger.log(
          `XAF conversion: ${senderTotal} XAF = ${conversion.convertedAmount} EUR (rate: ${conversion.exchangeRate})`
        );
        
        // Update amounts for Stripe processing
        currency = 'EUR';
        // Note: We keep the original XAF amounts in metadata for display
      }
      
      // Validate currency is supported by Stripe (let Stripe handle validation)
      // Stripe will throw an error if currency is not supported

      this.logger.log(
        `Payment breakdown - Traveler gets: ${currency}${travelerPrice.toFixed(2)}, ` +
          `Platform fee: ${currency}${platformFee.toFixed(2)}, ` +
          `Sender pays: ${currency}${senderTotal.toFixed(2)}`,
      );

      // Create new PaymentIntent with CALCULATED amount (secure)
      const metadata: Record<string, string> = {
        senderId,
        travelerId: travelerId,
        travelerPrice: travelerPrice.toFixed(2),
        platformFee: platformFee.toFixed(2),
        senderTotal: senderTotal.toFixed(2),
      };

      // Add XAF conversion info if original currency was XAF
      if (order.currency?.toUpperCase() === 'XAF') {
        const conversion = this.currencyService.convertCurrency(
          senderTotal,
          'XAF',
          'EUR'
        );
        metadata.originalCurrency = 'XAF';
        metadata.originalAmount = senderTotal.toFixed(2);
        metadata.exchangeRate = conversion.exchangeRate.toString();
        metadata.convertedAmount = conversion.convertedAmount.toFixed(2);
      }

      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: senderTotal,
        currency: currency,
        orderId: dto.orderId,
        travelerId: travelerId,
        metadata,
      });

      // Update order with payment information
      await this.prisma.tripRequest.update({
        where: { id: dto.orderId },
        data: {
          payment_intent_id: paymentIntent.id,
          currency: currency,
          payment_status: PaymentStatus.PROCESSING,
        },
      });

      this.logger.log(
        `PaymentIntent created successfully: ${paymentIntent.id}`,
      );

      // Create or get customer for the sender
      let customer;
      try {
        // Try to find existing customer by email
        const existingCustomers = await this.stripeService.getStripeInstance().customers.list({
          email: order.user.email,
          limit: 1,
        });
        
        if (existingCustomers.data.length > 0) {
          customer = existingCustomers.data[0];
          this.logger.log(`Using existing customer: ${customer.id}`);
        } else {
          // Create new customer
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
        this.logger.error('Failed to create/get customer:', error);
        throw new BadRequestException('Failed to create customer for payment');
      }

      // Create ephemeral key for the customer
      let ephemeralKey;
      try {
        ephemeralKey = await this.stripeService.createEphemeralKey(customer.id);
      } catch (error) {
        this.logger.error('Failed to create ephemeral key:', error);
        throw new BadRequestException('Failed to create ephemeral key for payment');
      }

      return {
        clientSecret: paymentIntent.id,
        paymentIntentId: paymentIntent.client_secret,
        amount: senderTotal,
        currency: currency,
        ephemeralKeySecret: ephemeralKey.secret,
        customerId: customer.id,
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
        this.logger.warn(
          `Order not found for PaymentIntent: ${paymentIntentId}`,
        );
        return;
      }

      // IDEMPOTENCY: Check if payment already processed
      if (order.payment_status === PaymentStatus.SUCCEEDED) {
        this.logger.log(`Payment already processed for order ${order.id}`);
        return;
      }

        // Update payment status only
        await this.prisma.tripRequest.update({
          where: { id: order.id },
          data: {
            payment_status: PaymentStatus.SUCCEEDED,
            paid_at: new Date(),
          },
        });

        // Use the proper endpoint to change status to CONFIRMED
        // For payment success, we use the sender ID since they initiated the payment
        await this.requestService.changeRequestStatus(
          order.id,
          'CONFIRMED',
          order.user_id, // sender ID (who made the payment)
          'en'
        );

      // Get or create wallet for traveler
      const wallet = await this.ensureWallet(order.trip.user_id);
      
      // Get currency from order (this is the actual payment currency from Stripe)
      const paymentCurrency = order.currency || 'EUR';
      
      // Update wallet currency to match the payment currency if it's the first payment
      if (wallet.currency !== paymentCurrency) {
        await this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { currency: paymentCurrency },
        });
      }

      // Client spec: Traveler receives EXACTLY their set price
      // Sender pays: travelerPrice + platformFee
      // Platform keeps the fee (Stripe fee comes out of platform's share)
      const travelerPrice = Number(order.cost || 0);
      const pendingEarnings = travelerPrice;

      // Log the breakdown for tracking
      let stripeFee = 0;
      try {
        stripeFee = await this.stripeService.getStripeFee(paymentIntentId);
      } catch (error) {
        this.logger.warn(
          `Could not retrieve Stripe fee for ${paymentIntentId}: ${error.message}`,
        );
        // Continue without Stripe fee in logs - payment still succeeds
      }

      const platformCommission =
        this.calculatePlatformCommission(travelerPrice);

      this.logger.log(
        `Payment breakdown - Traveler gets: ${paymentCurrency}${travelerPrice}, Platform fee: ${paymentCurrency}${platformCommission}, Stripe fee: ${paymentCurrency}${stripeFee}`,
      );

      // Validate earnings
      if (isNaN(pendingEarnings) || pendingEarnings <= 0) {
        throw new Error(`Invalid traveler price: ${pendingEarnings}`);
      }

      // Get the appropriate currency columns for the payment currency
      const currencyColumns = this.getCurrencyColumns(paymentCurrency);
      
      // Add to pending balance using currency-specific column
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          [currencyColumns.hold]: {
            increment: Number(pendingEarnings),
          },
        },
      });

      // Get current balance for the specific currency
      const currentBalance = Number(wallet[currencyColumns.hold] || 0);
      
      // Create transaction record
      await this.prisma.transaction.create({
        data: {
          userId: order.trip.user_id,
          wallet_id: wallet.id,
          type: 'CREDIT',
          source: 'TRIP_EARNING',
          amount_requested: travelerPrice,
          fee_applied: stripeFee + platformCommission,
          amount_paid: pendingEarnings,
          currency: paymentCurrency, // Use the actual payment currency
          request_id: order.id,
          status: 'ONHOLD',
          provider: 'STRIPE',
          description: `Earnings from order ${order.id} (pending delivery)`,
          balance_after: currentBalance + pendingEarnings,
          metadata: {
            orderId: order.id,
            stripeFee,
            platformCommission,
            paymentCurrency,
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
        // Create new Express account with user-provided address (required)
        const result = await this.stripeService.ensureConnectedAccount({
          userId: user.id,
          email: user.email,
          country: dto.country || await this.detectCountryFromUser(user),
          street: dto.street,
          apartment: dto.apartment,
          city: dto.city,
          postalCode: dto.postalCode,
          firstName: user.firstName,
          lastName: user.lastName,
        });

        accountId = result.accountId;
        isNewAccount = result.isNew;

        // Save account ID to user
        const detectedCountry = dto.country || await this.detectCountryFromUser(user);
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            stripe_account_id: accountId,
            payout_country: detectedCountry,
          },
        });
      }

      // Create onboarding link
      const onboardingUrl =
        await this.stripeService.createAccountLink(accountId);

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
   * Auto-detect country from user data using KYC verification data
   */
  private async detectCountryFromUser(user: any): Promise<string> {
    // 1. Try to get country from KYC phone verification data
    const kycCountry = await this.getCountryFromKYCPhone(user.id);
    if (kycCountry) {
      this.logger.log(`Detected country from KYC phone verification: ${kycCountry}`);
      return kycCountry;
    }
    
    // 2. Try address country if stored
    if (user.country) {
      this.logger.log(`Using stored country: ${user.country}`);
      return user.country;
    }
    
    // 3. Default fallback to US (most permissive for testing)
    this.logger.log('No country detected, defaulting to US');
    return 'US';
  }

  /**
   * Extract country from KYC phone verification data
   */
  private async getCountryFromKYCPhone(userId: string): Promise<string | null> {
    try {
      const kycData = await this.prisma.userKYC.findFirst({
        where: { userId },
        select: { verificationData: true },
      });

      if (!kycData?.verificationData) {
        return null;
      }

      const verificationData = kycData.verificationData as any;
      
      // Check if phone verification data exists and has country_code in decision.phone
      if (verificationData.decision?.phone?.country_code) {
        const countryCode = verificationData.decision.phone.country_code;
        this.logger.log(`Found country code from KYC phone verification: ${countryCode}`);
        return countryCode;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to get country from KYC phone verification:`, error);
      return null;
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
      const account = await this.stripeService.getAccountDetails(
        user.stripe_account_id,
      );

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
  async calculatePaymentBreakdown(
    travelerPrice: number,
    currency: string = 'EUR',
  ): Promise<any> {
    const platformFee = this.calculatePlatformCommission(travelerPrice);
    const senderTotal = travelerPrice + platformFee;

    const feePercent = Number(
      this.configService.get<number>('VELRO_FEE_PERCENT'),
    );
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
    // Client spec: 7% + €1.00 (minimum €1.99, no maximum)
    const feePercent = Number(
      this.configService.get<number>('VELRO_FEE_PERCENT'),
    );
    const feeFixed = Number(this.configService.get<number>('VELRO_FEE_FIXED'));
    const feeMin = Number(this.configService.get<number>('VELRO_FEE_MIN'));

    let commission = (grossAmount * feePercent) / 100 + feeFixed;
    commission = Math.max(commission, feeMin);

    return Math.round(commission * 100) / 100; // Round to 2 decimals
  }

  /**
   * Get the appropriate currency column names for a given currency
   */
  private getCurrencyColumns(currency: string): {
    available: string;
    hold: string;
  } {
    switch (currency.toUpperCase()) {
      case 'EUR':
        return { available: 'available_balance_eur', hold: 'hold_balance_eur' };
      case 'USD':
        return { available: 'available_balance_usd', hold: 'hold_balance_usd' };
      case 'CAD':
        return { available: 'available_balance_cad', hold: 'hold_balance_cad' };
      case 'XAF':
        // XAF is display only, convert to EUR for processing
        return { available: 'available_balance_eur', hold: 'hold_balance_eur' };
      default:
        // Default to EUR for unknown currencies
        return { available: 'available_balance_eur', hold: 'hold_balance_eur' };
    }
  }

  /**
   * Ensure wallet exists for user
   */
  private async ensureWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      // Get the user's first transaction currency to determine wallet currency
      const firstTransaction = await this.prisma.transaction.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { currency: true },
      });

      // Use the currency from user's first transaction, or null if no transactions yet
      const walletCurrency = firstTransaction?.currency || null;

      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          // Initialize currency-specific balances to 0
          available_balance_eur: 0,
          available_balance_usd: 0,
          available_balance_cad: 0,
          available_balance_xaf: 0, // Display only, not processed
          hold_balance_eur: 0,
          hold_balance_usd: 0,
          hold_balance_cad: 0,
          hold_balance_xaf: 0, // Display only, not processed
          available_balance: 0,
          hold_balance: 0,
          total_balance: 0,
          state: 'BLOCKED',
          currency: walletCurrency, // User's actual selection
        },
      });
    }

    return wallet;
  }

  /**
   * Handle refund webhook from Stripe
   */
  async handleRefund(refund: any): Promise<void> {
    try {
      this.logger.log(`Handling refund: ${refund.id}`);

      // Find the related order by payment intent
      const order = await this.prisma.tripRequest.findFirst({
        where: { payment_intent_id: refund.payment_intent },
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
        this.logger.warn(`Order not found for refund ${refund.id}`);
        return;
      }

      // Record refund transaction (for tracking purposes)
      try {
        const senderWallet = await this.prisma.wallet.findUnique({
          where: { userId: order.user_id },
        });

        if (senderWallet) {
          const refundCurrency = refund.currency?.toUpperCase?.() || 'EUR';
          const balanceAfter = this.getWalletCurrencyBalance(senderWallet, refundCurrency);
          await this.prisma.transaction.create({
            data: {
              userId: order.user_id, // Sender
              type: 'CREDIT',
              amount_requested: refund.amount / 100, // Convert from cents
              fee_applied: 0,
              amount_paid: refund.amount / 100,
              wallet_id: senderWallet.id,
              currency: refundCurrency,
              description: `Refund for order ${order.id}`,
              source: 'REFUND',
              balance_after: balanceAfter, // No change to wallet balance
              provider: 'STRIPE',
            },
          });
        }
      } catch (error) {
        this.logger.warn(`Could not record refund transaction: ${error.message}`);
        // Continue without failing the refund
      }

      this.logger.log(`Refund processed for order ${order.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle PaymentIntent cancellation webhook
   */
  async handlePaymentCancellation(paymentIntentId: string): Promise<void> {
    try {
      this.logger.log(`Handling PaymentIntent cancellation: ${paymentIntentId}`);

      // Find the related order
      const order = await this.prisma.tripRequest.findFirst({
        where: { payment_intent_id: paymentIntentId },
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
        this.logger.warn(`Order not found for canceled PaymentIntent ${paymentIntentId}`);
        return;
      }

      // Update order status to cancelled
      await this.prisma.tripRequest.update({
        where: { id: order.id },
        data: {
          payment_status: PaymentStatus.FAILED,
          status: 'CANCELLED',
          cancelled_at: new Date(),
        },
      });

      // Record cancellation transaction (for tracking purposes)
      try {
        const senderWallet = await this.prisma.wallet.findUnique({
          where: { userId: order.user_id },
        });

        if (senderWallet) {
          const cancelCurrency = (order.currency || 'EUR').toUpperCase();
          const balanceAfter = this.getWalletCurrencyBalance(senderWallet, cancelCurrency);
          await this.prisma.transaction.create({
            data: {
              userId: order.user_id, // Sender
              type: 'CREDIT',
              amount_requested: Number(order.cost || 0),
              fee_applied: 0,
              amount_paid: Number(order.cost || 0),
              wallet_id: senderWallet.id,
              currency: cancelCurrency,
              description: `Payment cancelled for order ${order.id}`,
              source: 'PAYMENT_CANCELLATION',
              balance_after: balanceAfter, // No change to wallet balance
              provider: 'STRIPE',
            },
          });
        }
      } catch (error) {
        this.logger.warn(`Could not record cancellation transaction: ${error.message}`);
        // Continue without failing the cancellation
      }

      this.logger.log(`Payment cancellation processed for order ${order.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle payment cancellation: ${error.message}`);
      throw error;
    }
  }

  // Helpers for currency-specific wallet balances
  private getWalletCurrencyBalance(wallet: any, currency: string): number {
    const c = (currency || 'EUR').toUpperCase();
    switch (c) {
      case 'XAF':
        return Number(wallet.available_balance_xaf || 0);
      case 'USD':
        return Number(wallet.available_balance_usd || 0);
      case 'CAD':
        return Number(wallet.available_balance_cad || 0);
      case 'EUR':
      default:
        return Number(wallet.available_balance_eur || 0);
    }
  }
}
