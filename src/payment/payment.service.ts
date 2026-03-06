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
import {
  PaymentStatus,
  NotificationType,
  TransactionProvider,
  TransactionStatus,
} from 'generated/prisma';
import { RequestService } from '../request/request.service';
import { CurrencyService } from '../currency/currency.service';
import { NotificationService } from '../notification/notification.service';
import { AdminPaymentMethodRankingResponseDto } from './dto/admin-payment-method-ranking.dto';

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
    private readonly notificationService: NotificationService,
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
   * Create a PaymentIntent for sender to pay for order.
   * Supports trip (default), shopping_offer, and shipping_offer order types.
   */
  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
    senderId: string,
  ): Promise<PaymentIntentResponseDto> {
    const orderType = dto.orderType || 'trip';

    if (orderType === 'shopping_offer') {
      return this.createPaymentIntentForShoppingOffer(dto, senderId);
    }
    if (orderType === 'shipping_offer') {
      return this.createPaymentIntentForShippingOffer(dto, senderId);
    }

    return this.createPaymentIntentForTrip(dto, senderId);
  }

  private async createPaymentIntentForTrip(
    dto: CreatePaymentIntentDto,
    senderId: string,
  ): Promise<PaymentIntentResponseDto> {
    try {
      this.logger.log(
        `Creating payment for order ${dto.orderId} by sender ${senderId}`,
      );

      const order = await this.prisma.tripRequest.findUnique({
        where: { id: dto.orderId },
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
        throw new BadRequestException('You can only pay for your own orders');
      }

      if (order.payment_intent_id) {
        const existingIntent = await this.stripeService.getPaymentIntent(
          order.payment_intent_id,
        );

        if (existingIntent.status === 'succeeded') {
          throw new BadRequestException('This order has already been paid');
        }

        if (existingIntent.payment_method_types?.includes('customer_balance')) {
          this.logger.log(
            `Existing PaymentIntent ${order.payment_intent_id} is bank transfer type, canceling to create card payment`,
          );

          try {
            await this.stripeService.cancelPaymentIntent(
              order.payment_intent_id,
            );
            this.logger.log(
              `Canceled bank transfer PaymentIntent: ${order.payment_intent_id}`,
            );
          } catch (cancelError) {
            this.logger.warn(
              `Could not cancel old PaymentIntent: ${cancelError.message}`,
            );
          }

          await this.prisma.tripRequest.update({
            where: { id: dto.orderId },
            data: { payment_intent_id: null },
          });
        } else {
          return this.returnExistingIntent(
            existingIntent,
            order.user.email,
            senderId,
            order.user,
          );
        }
      }

      const travelerId = order.trip.user_id;

      const tripCurrency = (order.trip.currency || 'EUR').toUpperCase();
      const requestCurrency = (order.currency || 'XAF').toUpperCase();

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
          `Currency conversion for Stripe: ${requestCost} ${requestCurrency} = ${travelerPrice} ${currency} (rate: ${conversion.exchangeRate})`,
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
          `XAF to EUR conversion for Stripe: ${requestCost} XAF = ${travelerPrice} EUR (rate: ${conversion.exchangeRate})`,
        );
      }

      const platformFee = this.calculatePlatformCommission(travelerPrice);
      const senderTotal = travelerPrice + platformFee;

      this.logger.log(
        `Payment breakdown - Traveler gets: ${currency}${travelerPrice.toFixed(2)}, ` +
          `Platform fee: ${currency}${platformFee.toFixed(2)}, ` +
          `Sender pays: ${currency}${senderTotal.toFixed(2)}`,
      );

      const metadata: Record<string, string> = {
        senderId,
        travelerId: travelerId,
        orderType: 'trip',
        travelerPrice: travelerPrice.toFixed(2),
        platformFee: platformFee.toFixed(2),
        senderTotal: senderTotal.toFixed(2),
      };

      if (dto.deviceId) {
        metadata.payerDeviceId = dto.deviceId;
      }

      if (requestCurrency !== currency) {
        metadata.requestCurrency = requestCurrency;
        metadata.requestAmount = requestCost.toFixed(2);
        metadata.paymentCurrency = currency;
        metadata.paymentAmount = senderTotal.toFixed(2);
      }

      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: senderTotal,
        currency: currency,
        orderId: dto.orderId,
        travelerId: travelerId,
        metadata,
      });

      await this.prisma.tripRequest.update({
        where: { id: dto.orderId },
        data: {
          payment_intent_id: paymentIntent.id,
          payment_status: PaymentStatus.PROCESSING,
        },
      });

      this.logger.log(
        `PaymentIntent created successfully: ${paymentIntent.id}`,
      );

      return this.buildPaymentIntentResponse(
        paymentIntent,
        senderTotal,
        currency,
        order.user.email,
        senderId,
        order.user,
      );
    } catch (error) {
      this.logger.error('Failed to create payment intent:', error);
      throw error;
    }
  }

  private async createPaymentIntentForShoppingOffer(
    dto: CreatePaymentIntentDto,
    senderId: string,
  ): Promise<PaymentIntentResponseDto> {
    try {
      this.logger.log(
        `Creating shopping offer payment for offer ${dto.orderId} by sender ${senderId}`,
      );

      const offer = await this.prisma.offer.findUnique({
        where: { id: dto.orderId },
        include: {
          shopping_request: {
            include: { user: true },
          },
          traveler: true,
        },
      });

      if (!offer) {
        throw new NotFoundException('Shopping offer not found');
      }

      if (offer.shopping_request.user_id !== senderId) {
        throw new BadRequestException(
          'You can only pay for your own shopping requests',
        );
      }

      if (offer.status !== 'ACCEPTED') {
        throw new BadRequestException('Only accepted offers can be paid');
      }

      if (offer.payment_intent_id) {
        const existingIntent = await this.stripeService.getPaymentIntent(
          offer.payment_intent_id,
        );
        if (existingIntent.status === 'succeeded') {
          throw new BadRequestException('This offer has already been paid');
        }
        if (existingIntent.payment_method_types?.includes('customer_balance')) {
          try {
            await this.stripeService.cancelPaymentIntent(
              offer.payment_intent_id,
            );
          } catch (cancelError) {
            this.logger.warn(
              `Could not cancel old PaymentIntent: ${cancelError.message}`,
            );
          }
          await this.prisma.offer.update({
            where: { id: dto.orderId },
            data: { payment_intent_id: null },
          });
        } else {
          return this.returnExistingIntent(
            existingIntent,
            offer.shopping_request.user.email,
            senderId,
            offer.shopping_request.user,
          );
        }
      }

      const productPrice = Number(offer.shopping_request.product_price || 0);
      const additionalFees = Number(offer.additional_fees || 0);
      const rewardAmount = Number(offer.reward_amount || 0);
      const baseAmount = productPrice + additionalFees + rewardAmount;

      if (baseAmount <= 0) {
        throw new BadRequestException('Invalid offer amount');
      }

      const rewardCurrency = (offer.reward_currency || 'XAF').toUpperCase();
      let travelerPrice: number;
      let currency: string;

      if (rewardCurrency === 'XAF') {
        const conversion = this.currencyService.convertCurrency(
          baseAmount,
          'XAF',
          'EUR',
        );
        travelerPrice = conversion.convertedAmount;
        currency = 'EUR';
      } else {
        travelerPrice = baseAmount;
        currency = rewardCurrency;
      }

      const platformFee = this.calculatePlatformCommission(travelerPrice);
      const senderTotal = travelerPrice + platformFee;

      this.logger.log(
        `Shopping offer payment breakdown - Base: ${currency}${travelerPrice.toFixed(2)}, ` +
          `Platform fee: ${currency}${platformFee.toFixed(2)}, ` +
          `Sender pays: ${currency}${senderTotal.toFixed(2)}`,
      );

      const metadata: Record<string, string> = {
        senderId,
        travelerId: offer.traveler_id,
        orderType: 'shopping_offer',
        offerId: offer.id,
        shoppingRequestId: offer.shopping_request_id,
        travelerPrice: travelerPrice.toFixed(2),
        platformFee: platformFee.toFixed(2),
        senderTotal: senderTotal.toFixed(2),
      };

      if (dto.deviceId) {
        metadata.payerDeviceId = dto.deviceId;
      }

      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: senderTotal,
        currency,
        orderId: dto.orderId,
        travelerId: offer.traveler_id,
        metadata,
      });

      await this.prisma.offer.update({
        where: { id: dto.orderId },
        data: {
          payment_intent_id: paymentIntent.id,
          payment_status: PaymentStatus.PROCESSING,
        },
      });

      this.logger.log(
        `Shopping offer PaymentIntent created: ${paymentIntent.id}`,
      );

      return this.buildPaymentIntentResponse(
        paymentIntent,
        senderTotal,
        currency,
        offer.shopping_request.user.email,
        senderId,
        offer.shopping_request.user,
      );
    } catch (error) {
      this.logger.error(
        'Failed to create shopping offer payment intent:',
        error,
      );
      throw error;
    }
  }

  private async createPaymentIntentForShippingOffer(
    dto: CreatePaymentIntentDto,
    senderId: string,
  ): Promise<PaymentIntentResponseDto> {
    try {
      this.logger.log(
        `Creating shipping offer payment for offer ${dto.orderId} by sender ${senderId}`,
      );

      const offer = await this.prisma.shippingOffer.findUnique({
        where: { id: dto.orderId },
        include: {
          shipping_request: {
            include: { user: true },
          },
          traveler: true,
        },
      });

      if (!offer) {
        throw new NotFoundException('Shipping offer not found');
      }

      if (offer.shipping_request.user_id !== senderId) {
        throw new BadRequestException(
          'You can only pay for your own shipping requests',
        );
      }

      if (offer.status !== 'ACCEPTED') {
        throw new BadRequestException('Only accepted offers can be paid');
      }

      if (offer.payment_intent_id) {
        const existingIntent = await this.stripeService.getPaymentIntent(
          offer.payment_intent_id,
        );
        if (existingIntent.status === 'succeeded') {
          throw new BadRequestException('This offer has already been paid');
        }
        if (existingIntent.payment_method_types?.includes('customer_balance')) {
          try {
            await this.stripeService.cancelPaymentIntent(
              offer.payment_intent_id,
            );
          } catch (cancelError) {
            this.logger.warn(
              `Could not cancel old PaymentIntent: ${cancelError.message}`,
            );
          }
          await this.prisma.shippingOffer.update({
            where: { id: dto.orderId },
            data: { payment_intent_id: null },
          });
        } else {
          return this.returnExistingIntent(
            existingIntent,
            offer.shipping_request.user.email,
            senderId,
            offer.shipping_request.user,
          );
        }
      }

      const rewardAmount = Number(offer.reward_amount || 0);
      if (rewardAmount <= 0) {
        throw new BadRequestException('Invalid offer amount');
      }

      const rewardCurrency = (offer.reward_currency || 'XAF').toUpperCase();
      let travelerPrice: number;
      let currency: string;

      if (rewardCurrency === 'XAF') {
        const conversion = this.currencyService.convertCurrency(
          rewardAmount,
          'XAF',
          'EUR',
        );
        travelerPrice = conversion.convertedAmount;
        currency = 'EUR';
      } else {
        travelerPrice = rewardAmount;
        currency = rewardCurrency;
      }

      const platformFee = this.calculatePlatformCommission(travelerPrice);
      const senderTotal = travelerPrice + platformFee;

      this.logger.log(
        `Shipping offer payment breakdown - Reward: ${currency}${travelerPrice.toFixed(2)}, ` +
          `Platform fee: ${currency}${platformFee.toFixed(2)}, ` +
          `Sender pays: ${currency}${senderTotal.toFixed(2)}`,
      );

      const metadata: Record<string, string> = {
        senderId,
        travelerId: offer.traveler_id,
        orderType: 'shipping_offer',
        shippingOfferId: offer.id,
        shippingRequestId: offer.shipping_request_id,
        travelerPrice: travelerPrice.toFixed(2),
        platformFee: platformFee.toFixed(2),
        senderTotal: senderTotal.toFixed(2),
      };

      if (dto.deviceId) {
        metadata.payerDeviceId = dto.deviceId;
      }

      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: senderTotal,
        currency,
        orderId: dto.orderId,
        travelerId: offer.traveler_id,
        metadata,
      });

      await this.prisma.shippingOffer.update({
        where: { id: dto.orderId },
        data: {
          payment_intent_id: paymentIntent.id,
          payment_status: PaymentStatus.PROCESSING,
        },
      });

      this.logger.log(
        `Shipping offer PaymentIntent created: ${paymentIntent.id}`,
      );

      return this.buildPaymentIntentResponse(
        paymentIntent,
        senderTotal,
        currency,
        offer.shipping_request.user.email,
        senderId,
        offer.shipping_request.user,
      );
    } catch (error) {
      this.logger.error(
        'Failed to create shipping offer payment intent:',
        error,
      );
      throw error;
    }
  }

  private async returnExistingIntent(
    existingIntent: any,
    email: string,
    senderId: string,
    user: any,
  ): Promise<PaymentIntentResponseDto> {
    const { customer, ephemeralKey } = await this.getOrCreateCustomerAndKey(
      email,
      senderId,
      user,
    );
    return {
      clientSecret: existingIntent.id,
      paymentIntentId: existingIntent.client_secret,
      amount: existingIntent.amount / 100,
      currency: existingIntent.currency.toUpperCase(),
      ephemeralKeySecret: ephemeralKey.secret,
      customerId: customer.id,
    };
  }

  private async buildPaymentIntentResponse(
    paymentIntent: any,
    amount: number,
    currency: string,
    email: string,
    senderId: string,
    user: any,
  ): Promise<PaymentIntentResponseDto> {
    const { customer, ephemeralKey } = await this.getOrCreateCustomerAndKey(
      email,
      senderId,
      user,
    );
    return {
      clientSecret: paymentIntent.id,
      paymentIntentId: paymentIntent.client_secret,
      amount,
      currency,
      ephemeralKeySecret: ephemeralKey.secret,
      customerId: customer.id,
    };
  }

  private async getOrCreateCustomerAndKey(
    email: string,
    senderId: string,
    user: any,
  ): Promise<{ customer: any; ephemeralKey: any }> {
    let customer;
    try {
      const existingCustomers = await this.stripeService
        .getStripeInstance()
        .customers.list({ email, limit: 1 });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        customer = await this.stripeService.createCustomer({
          email,
          name: user.name || undefined,
          metadata: { userId: senderId, userRole: user.role },
        });
      }
    } catch (error) {
      this.logger.error('Failed to create/get customer:', error);
      throw new BadRequestException('Failed to create customer for payment');
    }

    let ephemeralKey;
    try {
      ephemeralKey = await this.stripeService.createEphemeralKey(customer.id);
    } catch (error) {
      this.logger.error('Failed to create ephemeral key:', error);
      throw new BadRequestException(
        'Failed to create ephemeral key for payment',
      );
    }

    return { customer, ephemeralKey };
  }

  /**
   * Handle successful payment (called by webhook).
   * Resolves the order by payment_intent_id across TripRequest, Offer, ShippingOffer.
   */
  async handlePaymentSuccess(paymentIntentId: string): Promise<void> {
    try {
      this.logger.log(`Handling successful payment: ${paymentIntentId}`);

      const paymentIntent =
        await this.stripeService.getPaymentIntent(paymentIntentId);
      const orderType = (paymentIntent.metadata as any)?.orderType || 'trip';

      if (orderType === 'shopping_offer') {
        return this.handleShoppingOfferPaymentSuccess(
          paymentIntentId,
          paymentIntent,
        );
      }
      if (orderType === 'shipping_offer') {
        return this.handleShippingOfferPaymentSuccess(
          paymentIntentId,
          paymentIntent,
        );
      }

      return this.handleTripPaymentSuccess(paymentIntentId, paymentIntent);
    } catch (error) {
      this.logger.error('Failed to handle payment success:', error);
      throw error;
    }
  }

  private async handleTripPaymentSuccess(
    paymentIntentId: string,
    paymentIntent: any,
  ): Promise<void> {
    const order = await this.prisma.tripRequest.findUnique({
      where: { payment_intent_id: paymentIntentId },
      include: {
        trip: { include: { user: true } },
      },
    });

    if (!order) {
      this.logger.warn(`Order not found for PaymentIntent: ${paymentIntentId}`);
      return;
    }

    const paymentCurrency = paymentIntent.currency.toUpperCase();
    const totalPaid = paymentIntent.amount / 100;

    let travelerPrice: number;
    if (paymentIntent.metadata?.travelerPrice) {
      travelerPrice = Number(paymentIntent.metadata.travelerPrice);
    } else {
      const tripCurrency = (order.trip.currency || 'EUR').toUpperCase();
      const requestCurrency = (order.currency || 'XAF').toUpperCase();
      const requestCost = Number(order.cost || 0);
      if (requestCurrency === 'XAF' && tripCurrency !== 'XAF') {
        const conversion = this.currencyService.convertCurrency(
          requestCost,
          'XAF',
          tripCurrency,
        );
        travelerPrice = conversion.convertedAmount;
      } else {
        travelerPrice = requestCost;
      }
    }

    if (order.payment_status === PaymentStatus.SUCCEEDED) {
      this.logger.log(`Payment already processed for order ${order.id}`);
      await this.sendPaymentNotifications(
        order.trip.user_id,
        order.user_id,
        paymentCurrency,
        travelerPrice,
        totalPaid,
        { order_id: order.id, trip_id: order.trip_id },
        paymentIntent,
        'trip',
      );
      return;
    }

    await this.prisma.tripRequest.update({
      where: { id: order.id },
      data: { payment_status: PaymentStatus.SUCCEEDED, paid_at: new Date() },
    });

    await this.requestService.changeRequestStatus(
      order.id,
      'CONFIRMED',
      order.user_id,
      'en',
      true,
    );

    await this.creditTravelerWallet(
      order.trip.user_id,
      travelerPrice,
      paymentCurrency,
      paymentIntentId,
      {
        source: 'TRIP_EARNING' as const,
        request_id: order.id,
        description: `Earnings from order ${order.id} (pending delivery)`,
        orderId: order.id,
      },
    );

    this.logger.log(`Payment processed successfully for order ${order.id}`);

    await this.sendPaymentNotifications(
      order.trip.user_id,
      order.user_id,
      paymentCurrency,
      travelerPrice,
      totalPaid,
      { order_id: order.id, trip_id: order.trip_id },
      paymentIntent,
      'trip',
    );
  }

  private async handleShoppingOfferPaymentSuccess(
    paymentIntentId: string,
    paymentIntent: any,
  ): Promise<void> {
    const offer = await this.prisma.offer.findUnique({
      where: { payment_intent_id: paymentIntentId },
      include: {
        shopping_request: { include: { user: true } },
        traveler: true,
      },
    });

    if (!offer) {
      this.logger.warn(
        `Shopping offer not found for PaymentIntent: ${paymentIntentId}`,
      );
      return;
    }

    const paymentCurrency = paymentIntent.currency.toUpperCase();
    const totalPaid = paymentIntent.amount / 100;
    const travelerPrice = Number(
      paymentIntent.metadata?.travelerPrice || totalPaid,
    );

    if (offer.payment_status === PaymentStatus.SUCCEEDED) {
      this.logger.log(
        `Payment already processed for shopping offer ${offer.id}`,
      );
      await this.sendPaymentNotifications(
        offer.traveler_id,
        offer.shopping_request.user_id,
        paymentCurrency,
        travelerPrice,
        totalPaid,
        { offer_id: offer.id, shopping_request_id: offer.shopping_request_id },
        paymentIntent,
        'shopping_offer',
      );
      return;
    }

    await this.prisma.offer.update({
      where: { id: offer.id },
      data: { payment_status: PaymentStatus.SUCCEEDED, paid_at: new Date() },
    });

    await this.prisma.shoppingRequest.update({
      where: { id: offer.shopping_request_id },
      data: { status: 'PAID', paid_at: new Date() },
    });

    await this.creditTravelerWallet(
      offer.traveler_id,
      travelerPrice,
      paymentCurrency,
      paymentIntentId,
      {
        source: 'SHOPPING_EARNING' as const,
        offer_id: offer.id,
        description: `Earnings from shopping offer ${offer.id} (pending delivery)`,
        orderId: offer.id,
      },
    );

    this.logger.log(`Shopping offer payment processed for offer ${offer.id}`);

    await this.sendPaymentNotifications(
      offer.traveler_id,
      offer.shopping_request.user_id,
      paymentCurrency,
      travelerPrice,
      totalPaid,
      { offer_id: offer.id, shopping_request_id: offer.shopping_request_id },
      paymentIntent,
      'shopping_offer',
    );
  }

  private async handleShippingOfferPaymentSuccess(
    paymentIntentId: string,
    paymentIntent: any,
  ): Promise<void> {
    const offer = await this.prisma.shippingOffer.findUnique({
      where: { payment_intent_id: paymentIntentId },
      include: {
        shipping_request: { include: { user: true } },
        traveler: true,
      },
    });

    if (!offer) {
      this.logger.warn(
        `Shipping offer not found for PaymentIntent: ${paymentIntentId}`,
      );
      return;
    }

    const paymentCurrency = paymentIntent.currency.toUpperCase();
    const totalPaid = paymentIntent.amount / 100;
    const travelerPrice = Number(
      paymentIntent.metadata?.travelerPrice || totalPaid,
    );

    if (offer.payment_status === PaymentStatus.SUCCEEDED) {
      this.logger.log(
        `Payment already processed for shipping offer ${offer.id}`,
      );
      await this.sendPaymentNotifications(
        offer.traveler_id,
        offer.shipping_request.user_id,
        paymentCurrency,
        travelerPrice,
        totalPaid,
        {
          shipping_offer_id: offer.id,
          shipping_request_id: offer.shipping_request_id,
        },
        paymentIntent,
        'shipping_offer',
      );
      return;
    }

    await this.prisma.shippingOffer.update({
      where: { id: offer.id },
      data: { payment_status: PaymentStatus.SUCCEEDED, paid_at: new Date() },
    });

    await this.prisma.shippingRequest.update({
      where: { id: offer.shipping_request_id },
      data: { status: 'BOOKED' },
    });

    await this.creditTravelerWallet(
      offer.traveler_id,
      travelerPrice,
      paymentCurrency,
      paymentIntentId,
      {
        source: 'SHIPPING_EARNING' as const,
        shipping_offer_id: offer.id,
        description: `Earnings from shipping offer ${offer.id} (pending delivery)`,
        orderId: offer.id,
      },
    );

    this.logger.log(`Shipping offer payment processed for offer ${offer.id}`);

    await this.sendPaymentNotifications(
      offer.traveler_id,
      offer.shipping_request.user_id,
      paymentCurrency,
      travelerPrice,
      totalPaid,
      {
        shipping_offer_id: offer.id,
        shipping_request_id: offer.shipping_request_id,
      },
      paymentIntent,
      'shipping_offer',
    );
  }

  private async creditTravelerWallet(
    travelerId: string,
    travelerPrice: number,
    paymentCurrency: string,
    paymentIntentId: string,
    opts: {
      source: 'TRIP_EARNING' | 'SHOPPING_EARNING' | 'SHIPPING_EARNING';
      request_id?: string;
      offer_id?: string;
      shipping_offer_id?: string;
      description: string;
      orderId: string;
    },
  ): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: travelerId },
    });

    if (!wallet) {
      this.logger.error(`Wallet not found for traveler ${travelerId}`);
      throw new NotFoundException('Traveler wallet not found.');
    }

    if (wallet.currency !== paymentCurrency) {
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { currency: paymentCurrency },
      });
    }

    let stripeFee = 0;
    try {
      stripeFee = await this.stripeService.getStripeFee(paymentIntentId);
    } catch (error) {
      this.logger.warn(
        `Could not retrieve Stripe fee for ${paymentIntentId}: ${error.message}`,
      );
    }

    const platformCommission = this.calculatePlatformCommission(travelerPrice);
    const pendingEarnings = travelerPrice;

    if (isNaN(pendingEarnings) || pendingEarnings <= 0) {
      throw new Error(`Invalid traveler price: ${pendingEarnings}`);
    }

    const currencyColumns = this.getCurrencyColumns(paymentCurrency);

    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { [currencyColumns.hold]: { increment: Number(pendingEarnings) } },
    });

    const currentBalance = Number(wallet[currencyColumns.hold] || 0);

    await this.prisma.transaction.create({
      data: {
        userId: travelerId,
        wallet_id: wallet.id,
        type: 'CREDIT',
        source: opts.source,
        amount_requested: travelerPrice,
        fee_applied: stripeFee + platformCommission,
        amount_paid: pendingEarnings,
        currency: paymentCurrency,
        request_id: opts.request_id,
        offer_id: opts.offer_id,
        shipping_offer_id: opts.shipping_offer_id,
        status: 'ONHOLD',
        provider: 'STRIPE',
        description: opts.description,
        balance_after: currentBalance + pendingEarnings,
        metadata: {
          orderId: opts.orderId,
          stripeFee,
          platformCommission,
          paymentCurrency,
        },
      },
    });
  }

  private async sendPaymentNotifications(
    travelerId: string,
    payerId: string,
    paymentCurrency: string,
    travelerPrice: number,
    totalPaid: number,
    dataContext: Record<string, any>,
    paymentIntent: any,
    orderType: string,
  ): Promise<void> {
    const payerDeviceId: string | null =
      (paymentIntent.metadata as any)?.payerDeviceId || null;

    const traveler = await this.prisma.user.findUnique({
      where: { id: travelerId },
      select: { lang: true },
    });
    const travelerLang = traveler?.lang || 'en';

    const typeLabel =
      orderType === 'shopping_offer'
        ? 'shopping request'
        : orderType === 'shipping_offer'
          ? 'shipping request'
          : 'trip';

    const notificationTitle = 'Payment Received';
    const notificationMessage = `You've received a payment of ${paymentCurrency} ${travelerPrice.toFixed(2)} for your ${typeLabel}. The funds are on hold until delivery is confirmed.`;
    const notificationData = {
      type: 'payment_received',
      amount: travelerPrice,
      currency: paymentCurrency,
      ...dataContext,
    };

    try {
      await this.notificationService.createNotification(
        {
          user_id: travelerId,
          title: notificationTitle,
          message: notificationMessage,
          type: NotificationType.REQUEST,
          data: notificationData,
        },
        travelerLang,
      );

      await this.notificationService.sendPushNotificationToUser(
        travelerId,
        notificationTitle,
        notificationMessage,
        notificationData,
        travelerLang,
      );

      if (payerDeviceId) {
        try {
          const payer = await this.prisma.user.findUnique({
            where: { id: payerId },
            select: { lang: true, push_notification: true },
          });
          if (payer?.push_notification) {
            const payerLang = payer?.lang || 'en';
            const payerTitle = await this.i18n.translate(
              'translation.notification.payment.success.title',
              { lang: payerLang, defaultValue: 'Payment Successful' },
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
                deviceId: payerDeviceId,
                title: payerTitle,
                body: payerMessage,
                data: {
                  type: 'payment_success',
                  amount: totalPaid,
                  currency: paymentCurrency,
                  ...dataContext,
                },
              },
              payerLang,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Failed to send payment success push to payer: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to create/send payment notification: ${error.message}`,
      );
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
        // Try to use user's country preference if provided, otherwise use detected country
        // If that fails or is unsupported, fallback to 'US' for account creation
        // User can always change their country during Stripe onboarding
        const preferredCountry =
          dto.country || (await this.detectCountryFromUser(user)) || 'US';

        // Try with preferred country first, fallback to US if it fails
        let accountCreationCountry = preferredCountry;
        let result;

        try {
          result = await this.stripeService.ensureConnectedAccount({
            userId: user.id,
            email: user.email,
            country: accountCreationCountry,
            // Address fields NOT provided - user will fill during onboarding
            firstName: user.firstName,
            lastName: user.lastName,
          });
        } catch (error) {
          // If preferred country fails (e.g., unsupported), retry with US
          if (accountCreationCountry !== 'US') {
            this.logger.warn(
              `Failed to create account with country ${accountCreationCountry}, retrying with US: ${error.message}`,
            );
            accountCreationCountry = 'US';
            result = await this.stripeService.ensureConnectedAccount({
              userId: user.id,
              email: user.email,
              country: accountCreationCountry, // Fallback to US
              firstName: user.firstName,
              lastName: user.lastName,
            });
          } else {
            // If US also fails, re-throw the error
            throw error;
          }
        }

        accountId = result.accountId;
        isNewAccount = result.isNew;

        // Save account ID to user (country will be updated after onboarding)
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            stripe_account_id: accountId,
            // payout_country will be set after user completes onboarding
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
      this.logger.log(
        `Detected country from KYC phone verification: ${kycCountry}`,
      );
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
        this.logger.log(
          `Found country code from KYC phone verification: ${countryCode}`,
        );
        return countryCode;
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get country from KYC phone verification:`,
        error,
      );
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

      // Get account details from Stripe with expanded capabilities
      const account = await this.stripeService.getAccountDetails(
        user.stripe_account_id,
      );

      // Handle capabilities - can be string or object with status
      const transfersCap = account.capabilities?.transfers;
      const transfersCapability =
        typeof transfersCap === 'string'
          ? transfersCap
          : (transfersCap as any)?.status || 'inactive';

      const cardPaymentsCap = account.capabilities?.card_payments;
      const cardPaymentsCapability =
        typeof cardPaymentsCap === 'string'
          ? cardPaymentsCap
          : (cardPaymentsCap as any)?.status || 'inactive';

      // PRODUCTION-READY LOGIC:
      // canWithdraw: Based on transfers capability (what actually enables payouts)
      // If transfers is 'active', Stripe allows payouts even if identity verification is pending
      // Identity verification may pause payouts later, but if active now, withdrawals work
      const canWithdraw = transfersCapability === 'active';

      // isComplete: Stricter check - all requirements met (for UI display of "fully verified")
      const isComplete =
        account.details_submitted === true &&
        transfersCapability === 'active' &&
        cardPaymentsCapability === 'active';

      // Check for pending requirements (for better user feedback)
      const requirements = (account as any).requirements;
      const currentlyDue = requirements?.currently_due || [];
      const pastDue = requirements?.past_due || [];
      const hasPendingRequirements =
        currentlyDue.length > 0 || pastDue.length > 0;

      // Log for debugging
      this.logger.log(
        `Connect status check for user ${userId}: ` +
          `details_submitted=${account.details_submitted}, ` +
          `transfers=${transfersCapability}, ` +
          `card_payments=${cardPaymentsCapability}, ` +
          `canWithdraw=${canWithdraw}, ` +
          `isComplete=${isComplete}, ` +
          `pending_requirements=${hasPendingRequirements}`,
      );

      // Update local database
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          transfers_capability: transfersCapability,
          stripe_onboarding_complete: isComplete,
          payout_country: account.country,
        },
      });

      return {
        isComplete,
        transfersCapability,
        canWithdraw: canWithdraw, // Based on transfers capability (production-ready)
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
  ): Promise<any[]> {
    const feePercent = Number(
      this.configService.get<number>('VELRO_FEE_PERCENT'),
    );
    // Fee fixed and min values from config are in EUR
    const feeFixedEUR = Number(
      this.configService.get<number>('VELRO_FEE_FIXED'),
    );
    const feeMinEUR = Number(this.configService.get<number>('VELRO_FEE_MIN'));

    // Convert fee fixed and min from EUR to input currency
    let feeFixed = feeFixedEUR;
    let feeMin = feeMinEUR;
    if (currency !== 'EUR') {
      const feeFixedConversion = this.currencyService.convertCurrency(
        feeFixedEUR,
        'EUR',
        currency,
      );
      feeFixed = feeFixedConversion.convertedAmount;

      const feeMinConversion = this.currencyService.convertCurrency(
        feeMinEUR,
        'EUR',
        currency,
      );
      feeMin = feeMinConversion.convertedAmount;
    }

    // Calculate platform fee in input currency
    let platformFee = (travelerPrice * feePercent) / 100 + feeFixed;
    platformFee = Math.max(platformFee, feeMin);
    platformFee = Math.round(platformFee * 100) / 100;

    const senderTotal = travelerPrice + platformFee;

    // Supported currencies
    const currencies = ['EUR', 'XAF', 'USD', 'CAD'];
    const results = [];

    for (const targetCurrency of currencies) {
      // Convert travelerPrice to target currency
      const travelerPriceConversion = this.currencyService.convertCurrency(
        travelerPrice,
        currency,
        targetCurrency,
      );
      const convertedTravelerPrice = travelerPriceConversion.convertedAmount;

      // Convert platformFee to target currency
      const platformFeeConversion = this.currencyService.convertCurrency(
        platformFee,
        currency,
        targetCurrency,
      );
      const convertedPlatformFee = platformFeeConversion.convertedAmount;

      // Convert senderTotal to target currency
      const senderTotalConversion = this.currencyService.convertCurrency(
        senderTotal,
        currency,
        targetCurrency,
      );
      const convertedSenderTotal = senderTotalConversion.convertedAmount;

      // Convert feeFixed and feeMin from EUR to target currency (for breakdown display)
      const feeFixedConversion = this.currencyService.convertCurrency(
        feeFixedEUR,
        'EUR',
        targetCurrency,
      );
      const convertedFeeFixed = feeFixedConversion.convertedAmount;

      const feeMinConversion = this.currencyService.convertCurrency(
        feeMinEUR,
        'EUR',
        targetCurrency,
      );
      const convertedFeeMin = feeMinConversion.convertedAmount;

      results.push({
        travelerPrice: Math.round(convertedTravelerPrice * 100) / 100,
        platformFee: Math.round(convertedPlatformFee * 100) / 100,
        senderTotal: Math.round(convertedSenderTotal * 100) / 100,
        currency: targetCurrency,
        breakdown: {
          feePercent,
          feeFixed: Math.round(convertedFeeFixed * 100) / 100,
          feeMin: Math.round(convertedFeeMin * 100) / 100,
        },
      });
    }

    return results;
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
   * Handle refund webhook from Stripe.
   * Resolves across TripRequest, Offer, ShippingOffer.
   */
  async handleRefund(refund: any): Promise<void> {
    try {
      this.logger.log(`Handling refund: ${refund.id}`);

      const refundCurrency = refund.currency?.toUpperCase?.() || 'EUR';
      const refundAmount = refund.amount / 100;
      const paymentIntentId = refund.payment_intent;

      // Try TripRequest first
      const order = await this.prisma.tripRequest.findFirst({
        where: { payment_intent_id: paymentIntentId },
        include: { trip: { include: { user: true } }, user: true },
      });

      if (order) {
        await this.recordRefundTransaction(
          order.user_id,
          refundCurrency,
          refundAmount,
          `Refund for order ${order.id}`,
        );

        await this.prisma.tripRequest.update({
          where: { id: order.id },
          data: { payment_status: PaymentStatus.REFUNDED },
        });

        this.logger.log(`Refund processed for trip order ${order.id}`);
        await this.sendRefundNotification(
          order.user_id,
          refundCurrency,
          refundAmount,
          { order_id: order.id, trip_id: order.trip_id },
        );
        return;
      }

      // Try Shopping Offer
      const shoppingOffer = await this.prisma.offer.findFirst({
        where: { payment_intent_id: paymentIntentId },
        include: { shopping_request: { include: { user: true } } },
      });

      if (shoppingOffer) {
        await this.recordRefundTransaction(
          shoppingOffer.shopping_request.user_id,
          refundCurrency,
          refundAmount,
          `Refund for shopping offer ${shoppingOffer.id}`,
        );

        await this.prisma.offer.update({
          where: { id: shoppingOffer.id },
          data: { payment_status: PaymentStatus.REFUNDED },
        });

        await this.prisma.shoppingRequest.update({
          where: { id: shoppingOffer.shopping_request_id },
          data: { status: 'OFFER_ACCEPTED' },
        });

        this.logger.log(
          `Refund processed for shopping offer ${shoppingOffer.id}`,
        );
        await this.sendRefundNotification(
          shoppingOffer.shopping_request.user_id,
          refundCurrency,
          refundAmount,
          {
            offer_id: shoppingOffer.id,
            shopping_request_id: shoppingOffer.shopping_request_id,
          },
        );
        return;
      }

      // Try Shipping Offer
      const shippingOffer = await this.prisma.shippingOffer.findFirst({
        where: { payment_intent_id: paymentIntentId },
        include: { shipping_request: { include: { user: true } } },
      });

      if (shippingOffer) {
        await this.recordRefundTransaction(
          shippingOffer.shipping_request.user_id,
          refundCurrency,
          refundAmount,
          `Refund for shipping offer ${shippingOffer.id}`,
        );

        await this.prisma.shippingOffer.update({
          where: { id: shippingOffer.id },
          data: { payment_status: PaymentStatus.REFUNDED },
        });

        await this.prisma.shippingRequest.update({
          where: { id: shippingOffer.shipping_request_id },
          data: { status: 'OFFER_ACCEPTED' },
        });

        this.logger.log(
          `Refund processed for shipping offer ${shippingOffer.id}`,
        );
        await this.sendRefundNotification(
          shippingOffer.shipping_request.user_id,
          refundCurrency,
          refundAmount,
          {
            shipping_offer_id: shippingOffer.id,
            shipping_request_id: shippingOffer.shipping_request_id,
          },
        );
        return;
      }

      this.logger.warn(
        `No order found for refund ${refund.id} (payment_intent: ${paymentIntentId})`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle PaymentIntent cancellation webhook.
   * Resolves across TripRequest, Offer, ShippingOffer.
   */
  async handlePaymentCancellation(paymentIntentId: string): Promise<void> {
    try {
      this.logger.log(
        `Handling PaymentIntent cancellation: ${paymentIntentId}`,
      );

      // Try TripRequest
      const order = await this.prisma.tripRequest.findFirst({
        where: { payment_intent_id: paymentIntentId },
        include: { trip: { include: { user: true } }, user: true },
      });

      if (order) {
        await this.prisma.tripRequest.update({
          where: { id: order.id },
          data: {
            payment_status: PaymentStatus.FAILED,
            status: 'CANCELLED',
            cancelled_at: new Date(),
          },
        });
        await this.recordCancellationTransaction(
          order.user_id,
          (order.currency || 'EUR').toUpperCase(),
          Number(order.cost || 0),
          `Payment cancelled for order ${order.id}`,
        );
        this.logger.log(`Payment cancellation processed for order ${order.id}`);
        return;
      }

      // Try Shopping Offer
      const shoppingOffer = await this.prisma.offer.findFirst({
        where: { payment_intent_id: paymentIntentId },
        include: { shopping_request: true },
      });

      if (shoppingOffer) {
        await this.prisma.offer.update({
          where: { id: shoppingOffer.id },
          data: { payment_status: PaymentStatus.FAILED },
        });
        await this.prisma.shoppingRequest.update({
          where: { id: shoppingOffer.shopping_request_id },
          data: { status: 'OFFER_ACCEPTED' },
        });
        this.logger.log(
          `Payment cancellation processed for shopping offer ${shoppingOffer.id}`,
        );
        return;
      }

      // Try Shipping Offer
      const shippingOffer = await this.prisma.shippingOffer.findFirst({
        where: { payment_intent_id: paymentIntentId },
        include: { shipping_request: true },
      });

      if (shippingOffer) {
        await this.prisma.shippingOffer.update({
          where: { id: shippingOffer.id },
          data: { payment_status: PaymentStatus.FAILED },
        });
        await this.prisma.shippingRequest.update({
          where: { id: shippingOffer.shipping_request_id },
          data: { status: 'OFFER_ACCEPTED' },
        });
        this.logger.log(
          `Payment cancellation processed for shipping offer ${shippingOffer.id}`,
        );
        return;
      }

      this.logger.warn(
        `Order not found for canceled PaymentIntent ${paymentIntentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle payment cancellation: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Trigger a refund for a paid shopping or shipping offer (called from offer services).
   */
  async refundOfferPayment(paymentIntentId: string): Promise<void> {
    const paymentIntent =
      await this.stripeService.getPaymentIntent(paymentIntentId);
    const amount = paymentIntent.amount / 100;
    const result = await this.stripeService.processCancellationOrRefund(
      paymentIntentId,
      amount,
    );
    this.logger.log(
      `Refund/cancel initiated for PaymentIntent ${paymentIntentId}: ${result.type}`,
    );
  }

  private async recordRefundTransaction(
    userId: string,
    currency: string,
    amount: number,
    description: string,
  ): Promise<void> {
    try {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (wallet) {
        const balanceAfter = this.getWalletCurrencyBalance(wallet, currency);
        await this.prisma.transaction.create({
          data: {
            userId,
            type: 'CREDIT',
            amount_requested: amount,
            fee_applied: 0,
            amount_paid: amount,
            wallet_id: wallet.id,
            currency,
            description,
            source: 'REFUND',
            balance_after: balanceAfter,
            provider: 'STRIPE',
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Could not record refund transaction: ${error.message}`);
    }
  }

  private async recordCancellationTransaction(
    userId: string,
    currency: string,
    amount: number,
    description: string,
  ): Promise<void> {
    try {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (wallet) {
        const balanceAfter = this.getWalletCurrencyBalance(wallet, currency);
        await this.prisma.transaction.create({
          data: {
            userId,
            type: 'CREDIT',
            amount_requested: amount,
            fee_applied: 0,
            amount_paid: amount,
            wallet_id: wallet.id,
            currency,
            description,
            source: 'PAYMENT_CANCELLATION',
            balance_after: balanceAfter,
            provider: 'STRIPE',
          },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Could not record cancellation transaction: ${error.message}`,
      );
    }
  }

  private async sendRefundNotification(
    userId: string,
    currency: string,
    amount: number,
    dataContext: Record<string, any>,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { lang: true },
      });
      const lang = user?.lang || 'en';
      const title = 'Refund Processed';
      const message = `Your refund of ${currency} ${amount.toFixed(2)} has been processed and will be returned to your payment method.`;
      const data = {
        type: 'refund_processed',
        amount,
        currency,
        ...dataContext,
      };

      await this.notificationService.createNotification(
        {
          user_id: userId,
          title,
          message,
          type: NotificationType.REQUEST,
          data,
        },
        lang,
      );
      await this.notificationService.sendPushNotificationToUser(
        userId,
        title,
        message,
        data,
        lang,
      );
    } catch (error) {
      this.logger.warn(`Failed to send refund notification: ${error.message}`);
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

  /**
   * Get payment method ranking grouped by TransactionProvider
   */
  async getAdminPaymentMethodRanking(
    lang?: string,
  ): Promise<AdminPaymentMethodRankingResponseDto> {
    try {
      // Get transactions grouped by provider with status SEND, RECEIVED, COMPLETED, SUCCESS
      // Use findMany and group manually to avoid Prisma groupBy TypeScript issues
      const allTransactions = await this.prisma.transaction.findMany({
        where: {
          status: {
            in: [
              TransactionStatus.SEND,
              TransactionStatus.RECEIVED,
              TransactionStatus.COMPLETED,
              TransactionStatus.SUCCESS,
            ],
          },
        },
        select: {
          provider: true,
        },
      });

      // Group manually and count
      const providerCountMap = new Map<TransactionProvider, number>();
      allTransactions.forEach((transaction) => {
        const currentCount = providerCountMap.get(transaction.provider) || 0;
        providerCountMap.set(transaction.provider, currentCount + 1);
      });

      // Convert to array format matching groupBy result structure
      const transactionsByProvider = Array.from(providerCountMap.entries()).map(
        ([provider, count]) => ({
          provider,
          _count: { id: count },
        }),
      );

      // Convert to response format and sort by count (descending)
      const paymentMethods = transactionsByProvider
        .map((item) => ({
          provider: item.provider as string,
          count: item._count.id,
        }))
        .sort((a, b) => b.count - a.count);

      const message = await this.i18n.translate(
        'translation.admin.paymentMethodRankingSuccess',
        {
          lang,
          defaultValue: 'Payment method ranking retrieved successfully',
        },
      );

      return {
        message,
        paymentMethods,
      };
    } catch (error) {
      console.error('Error getting payment method ranking:', error);
      const message = await this.i18n.translate(
        'translation.admin.paymentMethodRankingFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve payment method ranking',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Admin method to refund a request
   * Refunds to either sender or traveller, full or partial (50%)
   */
  async refundRequest(
    requestId: string,
    destination: 'sender' | 'traveller',
    portion: 'full' | 'partial',
    lang?: string,
  ): Promise<{
    message: string;
    transaction_id: string;
    amount_refunded: number;
    currency: string;
    destination_user_id: string;
  }> {
    try {
      // Get request with trip and user information
      const request = await this.prisma.tripRequest.findUnique({
        where: { id: requestId },
        include: {
          user: true, // Sender
          trip: {
            include: {
              user: true, // Traveller
            },
          },
        },
      });

      if (!request) {
        const message = await this.i18n.translate(
          'translation.request.notFound',
          {
            lang,
            defaultValue: 'Request not found',
          },
        );
        throw new NotFoundException(message);
      }

      if (!request.cost || !request.currency) {
        const message = await this.i18n.translate(
          'translation.payment.refund.noCost',
          {
            lang,
            defaultValue: 'Request has no cost to refund',
          },
        );
        throw new BadRequestException(message);
      }

      // Determine destination user
      const destinationUserId =
        destination === 'sender' ? request.user_id : request.trip.user_id;
      const destinationUser =
        destination === 'sender' ? request.user : request.trip.user;

      // Calculate refund amount
      const requestCost = Number(request.cost);
      const refundAmount =
        portion === 'full'
          ? requestCost
          : Math.round(requestCost * 0.5 * 100) / 100;
      const currency = request.currency;

      // Get or create wallet for destination user
      let wallet = await this.prisma.wallet.findUnique({
        where: { userId: destinationUserId },
      });

      if (!wallet) {
        // Create wallet if it doesn't exist
        wallet = await this.prisma.wallet.create({
          data: {
            userId: destinationUserId,
            currency: currency,
            available_balance_eur: 0,
            available_balance_usd: 0,
            available_balance_cad: 0,
            available_balance_xaf: 0,
            hold_balance_eur: 0,
            hold_balance_usd: 0,
            hold_balance_cad: 0,
            hold_balance_xaf: 0,
            available_balance: 0.0,
            hold_balance: 0.0,
            total_balance: 0.0,
            state: 'ACTIVE',
          },
        });
        this.logger.log(`Created wallet for user ${destinationUserId}`);
      }

      // Get currency columns
      const currencyColumns = this.getCurrencyColumns(currency);

      // Perform wallet update and transaction creation atomically
      const result = await this.prisma.$transaction(async (prisma) => {
        // Get current balance within transaction to avoid race conditions
        const walletWithBalance = await prisma.wallet.findUnique({
          where: { id: wallet.id },
        });

        if (!walletWithBalance) {
          throw new NotFoundException(
            `Wallet ${wallet.id} not found during transaction`,
          );
        }

        const currentBalance = this.getWalletCurrencyBalance(
          walletWithBalance,
          currency,
        );
        const newBalance = currentBalance + refundAmount;

        // Credit the refund amount to destination user's wallet
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            [currencyColumns.available]: {
              increment: refundAmount,
            },
          } as any,
        });

        // Create refund transaction
        const transaction = await prisma.transaction.create({
          data: {
            userId: destinationUserId,
            wallet_id: wallet.id,
            type: 'CREDIT',
            source: 'REFUND',
            amount_requested: refundAmount,
            fee_applied: 0,
            amount_paid: refundAmount,
            currency: currency,
            request_id: requestId,
            status: 'SUCCESS',
            provider: 'STRIPE', // Default provider for admin refunds
            description: `Admin refund (${portion}) for request ${requestId} to ${destination}`,
            balance_after: newBalance,
            metadata: {
              requestId,
              destination,
              portion,
              originalCost: requestCost,
              refundAmount,
            },
          },
        });

        // Update request status to REFUNDED
        await prisma.tripRequest.update({
          where: { id: requestId },
          data: {
            status: 'REFUNDED',
          },
        });

        return transaction;
      });

      const message = await this.i18n.translate(
        'translation.payment.refund.success',
        {
          lang,
          defaultValue: 'Refund processed successfully',
        },
      );

      this.logger.log(
        `Refunded ${currency} ${refundAmount} (${portion}) to ${destination} (${destinationUserId}) for request ${requestId}`,
      );

      return {
        message,
        transaction_id: result.id,
        amount_refunded: refundAmount,
        currency: currency,
        destination_user_id: destinationUserId,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Failed to process refund: ${error.message}`);
      const message = await this.i18n.translate(
        'translation.payment.refund.failed',
        {
          lang,
          defaultValue: 'Failed to process refund',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }
}
