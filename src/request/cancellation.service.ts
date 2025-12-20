import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { StripeService } from '../payment/stripe.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationService } from '../notification/notification.service';
import { 
  CancelRequestDto, 
  CancellationType,
  UnpaidCancellationReason,
  PaidCancellationReason,
  TravelerCancellationReason,
} from './dto/cancel-request.dto';
import { RequestStatus, PaymentStatus, NotificationType } from 'generated/prisma';

@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Cancel a trip request with proper fee distribution
   */
  async cancelRequest(
    requestId: string,
    cancellationDto: CancelRequestDto,
    userId: string,
    options?: {
      changeStatus?: (status: RequestStatus) => Promise<void>;
    },
  ) {
    const changeStatus = options?.changeStatus;
    this.logger.log(`Processing cancellation for request ${requestId}`);

    // Get request with all related data (exclude deleted)
    const request = await this.prisma.tripRequest.findFirst({
      where: {
        id: requestId,
        is_deleted: false, // Exclude deleted requests
      },
      include: {
        trip: {
          include: {
            user: true, // Traveler
          },
        },
        user: true, // Sender
      },
    });

    if (!request) {
      throw new NotFoundException('Trip request not found');
    }

    // Determine user role (sender or traveler)
    const isSender = request.user_id === userId;
    const isTraveler = request.trip.user_id === userId;

    // Validate user has permission to cancel
    if (!isSender && !isTraveler) {
      throw new BadRequestException('You are not authorized to cancel this request');
    }

    // Determine cancellation type automatically based on user role
    const cancellationType = isSender 
      ? CancellationType.SENDER_CANCEL 
      : CancellationType.TRAVELER_CANCEL;

    // Determine payment status from database
    const isPaid = request.payment_status === PaymentStatus.SUCCEEDED;
    const isUnpaid = !request.payment_status || request.payment_status === PaymentStatus.PENDING;

    // Validate cancellation reason based on actual payment status from database and cancellation type
    this.validateCancellationReason(cancellationType, isPaid, cancellationDto.reason);

    // Check if already cancelled
    if (request.status === RequestStatus.CANCELLED) {
      throw new BadRequestException('Request is already cancelled');
    }

    // IDEMPOTENCY: Check if refund already processed for paid requests
    if (request.payment_intent_id && request.payment_status === PaymentStatus.SUCCEEDED) {
      // Check payment provider to determine idempotency check method
      const paymentInfo = await this.getPaymentInfo(request.payment_intent_id);

      if (paymentInfo.provider === 'STRIPE' && paymentInfo.paymentIntentId) {
        // Stripe: Check Stripe refund status
      try {
          const paymentIntent = await this.stripeService.getPaymentIntent(paymentInfo.paymentIntentId);
        if (paymentIntent.status === 'succeeded' && paymentIntent.latest_charge) {
          const charge = await this.stripeService.getStripeInstance().charges.retrieve(
            paymentIntent.latest_charge as string
          );
          // If already fully or partially refunded, check if request status wasn't updated
          if (charge.amount_refunded > 0) {
            const refundedAmount = charge.amount_refunded / 100;
            const totalAmount = charge.amount / 100;
            this.logger.warn(
                `Request ${requestId} already has Stripe refund: ${refundedAmount}/${totalAmount}. ` +
              `Status may not have been updated. Checking...`
            );
            
            // If fully refunded, mark as cancelled
            if (charge.amount_refunded === charge.amount) {
              if (changeStatus) {
                await changeStatus(RequestStatus.CANCELLED);
                request.status = RequestStatus.CANCELLED;
              }
              await this.prisma.tripRequest.update({
                where: { id: requestId },
                data: {
                  ...(changeStatus ? {} : { status: RequestStatus.CANCELLED }),
                  cancelled_at: new Date(),
                  cancellation_type: cancellationType,
                  cancellation_reason: cancellationDto.reason,
                  updated_at: new Date(),
                },
              });
              throw new BadRequestException(
                `Request was already cancelled and fully refunded (${refundedAmount} ${paymentIntent.currency.toUpperCase()})`
              );
            }
            
            // If partially refunded, throw error
            throw new BadRequestException(
              `Request already has a partial refund of ${refundedAmount} ${paymentIntent.currency.toUpperCase()}. ` +
              `Cannot process another cancellation.`
            );
          }
        }
      } catch (error) {
        // If it's our custom error, re-throw it
        if (error instanceof BadRequestException) {
          throw error;
        }
        // Otherwise, log and continue (might be network issue, proceed with normal flow)
          this.logger.warn(`Could not check Stripe refund status: ${error.message}`);
        }
      } else if (paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN') {
        // Mobile Money: Check if refund transaction already exists
        const existingRefund = await this.prisma.transaction.findFirst({
          where: {
            request_id: requestId,
            source: 'REFUND',
            status: 'SUCCESS',
            provider: paymentInfo.provider,
          },
        });

        if (existingRefund) {
          throw new BadRequestException(
            `Request ${requestId} already has a refund transaction. ` +
            `Refund ID: ${existingRefund.id} (${existingRefund.amount_paid} ${existingRefund.currency})`
          );
        }
      }
    }

    // Update request status to CANCELLED BEFORE processing refund
    // This prevents duplicate refunds if processCancellation fails after refund
    if (changeStatus) {
      await changeStatus(RequestStatus.CANCELLED);
      request.status = RequestStatus.CANCELLED;
      await this.prisma.tripRequest.update({
        where: { id: requestId },
        data: {
          cancelled_at: new Date(),
          cancellation_type: cancellationType,
          cancellation_reason: cancellationDto.reason,
          updated_at: new Date(),
        },
      });
    } else {
      await this.prisma.tripRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.CANCELLED,
          cancelled_at: new Date(),
          cancellation_type: cancellationType,
          cancellation_reason: cancellationDto.reason,
          updated_at: new Date(),
        },
      });
    }

    // Process cancellation based on type and payment status from database
    // Status is already CANCELLED, so if this fails, retry will be blocked
    const cancellationResult = await this.processCancellation(request, cancellationType, cancellationDto);

    this.logger.log(`Cancellation completed for request ${requestId}`);
    return cancellationResult;
  }

  /**
   * Validate cancellation reason based on cancellation type and payment status
   */
  private validateCancellationReason(
    cancellationType: CancellationType,
    isPaid: boolean,
    reason?: string,
  ) {
    if (!reason) {
      return; // Reason is optional
    }

    // Traveler cancellations use specific traveler reasons (regardless of payment status)
    if (cancellationType === CancellationType.TRAVELER_CANCEL) {
      const travelerReasons = Object.values(TravelerCancellationReason);
      if (!travelerReasons.includes(reason as TravelerCancellationReason)) {
        throw new BadRequestException(
          `Invalid reason for traveler cancellation. Allowed reasons: ${travelerReasons.join(', ')}`
        );
      }
      return; // Traveler reasons are validated, no need to check payment status
    }

    // Sender cancellations use payment-status-based reasons
    const unpaidReasons = Object.values(UnpaidCancellationReason);
    const paidReasons = Object.values(PaidCancellationReason);

    if (isPaid) {
      if (!paidReasons.includes(reason as PaidCancellationReason)) {
        throw new BadRequestException(
          `Invalid reason for paid cancellation. Allowed reasons: ${paidReasons.join(', ')}`
        );
      }
    } else {
      if (!unpaidReasons.includes(reason as UnpaidCancellationReason)) {
        throw new BadRequestException(
          `Invalid reason for unpaid cancellation. Allowed reasons: ${unpaidReasons.join(', ')}`
        );
      }
    }
  }

  /**
   * Process cancellation with fee calculations
   */
  private async processCancellation(request: any, cancellationType: CancellationType, cancellationDto: CancelRequestDto) {
    const deliveryFee = Number(request.cost || 0);
    // Ensure currency is present on request for downstream operations
    if (!request.currency && request.trip?.currency) {
      request.currency = request.trip.currency;
    }
    
    // Determine payment status from database
    const paymentStatus = request.payment_status;
    const isPaid = paymentStatus === PaymentStatus.SUCCEEDED;
    const isUnpaid = !paymentStatus || paymentStatus === PaymentStatus.PENDING;

    // Case 1: Sender cancels before payment (unpaid)
    if (cancellationType === CancellationType.SENDER_CANCEL && isUnpaid) {
      return this.handleSenderCancelBeforePayment(request);
    }

    // Case 2: Sender cancels after payment (paid)
    if (cancellationType === CancellationType.SENDER_CANCEL && isPaid) {
      const currency = (request.currency || request.trip?.currency || 'EUR').toUpperCase();
      return this.handleSenderCancelAfterPayment(request, deliveryFee, currency);
    }

    // Case 3: Traveler cancels before payment (unpaid)
    if (cancellationType === CancellationType.TRAVELER_CANCEL && isUnpaid) {
      return this.handleTravelerCancelBeforePayment(request);
    }

    // Case 4: Traveler cancels after payment (paid)
    if (cancellationType === CancellationType.TRAVELER_CANCEL && isPaid) {
      const currency = (request.currency || request.trip?.currency || 'EUR').toUpperCase();
      return this.handleTravelerCancelAfterPayment(request, deliveryFee, currency);
    }

    // Case 5: System/Error cases
    const currency = (request.currency || request.trip?.currency || 'EUR').toUpperCase();
    return this.handleSystemCancellation(request, deliveryFee, cancellationType, currency);
  }

  /**
   * Sender cancels before payment - no fees
   */
  private async handleSenderCancelBeforePayment(request: any) {
    this.logger.log(`Sender cancelled before payment for request ${request.id}`);

    return {
      requestId: request.id,
      cancellationType: CancellationType.SENDER_CANCEL,
      refundAmount: 0,
      cancellationFee: 0,
      travelerCompensation: 0,
      velroFee: 0,
      status: 'CANCELLED',
      cancelledAt: new Date(),
    };
  }

  /**
   * Sender cancels after payment - apply cancellation fee
   */
  private async handleSenderCancelAfterPayment(request: any, deliveryFee: number, currency: string) {
    this.logger.log(`Sender cancelled after payment for request ${request.id}`);

    // Validate payment_intent_id exists for paid requests
    if (!request.payment_intent_id) {
      throw new BadRequestException(
        `Payment intent ID is missing for paid request ${request.id}. ` +
        `Cannot process refund without payment information.`
      );
    }

    // Get payment information to determine provider
    const paymentInfo = await this.getPaymentInfo(request.payment_intent_id);

    // Get actual payment amount based on provider
    let actualPaymentAmount = deliveryFee;
    if (paymentInfo.provider === 'STRIPE' && paymentInfo.paymentIntentId) {
      const paymentIntent = await this.stripeService.getPaymentIntent(paymentInfo.paymentIntentId);
        // PaymentIntent amount is in cents, convert to currency units
        actualPaymentAmount = paymentIntent.amount / 100;
        this.logger.log(
          `Actual payment amount from Stripe: ${actualPaymentAmount} ${paymentIntent.currency.toUpperCase()}, ` +
          `Delivery fee (traveler price): ${deliveryFee} ${currency}`
        );
    } else if (paymentInfo.transaction) {
      // For mobile money, use transaction amount
      actualPaymentAmount = Number(paymentInfo.transaction.amount_requested);
      // Use transaction currency for mobile money refunds (not request currency)
      const transactionCurrency = (paymentInfo.transaction.currency || 'XAF').toUpperCase();
      this.logger.log(
        `Actual payment amount from transaction: ${actualPaymentAmount} ${transactionCurrency}, ` +
        `Delivery fee (traveler price): ${deliveryFee} ${currency}`
      );
    }

    // For mobile money, use transaction currency for refunds; for Stripe, use request currency
    const refundCurrency = (paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN') 
      ? (paymentInfo.transaction?.currency || 'XAF').toUpperCase()
      : currency;

    // Calculate cancellation fee based on DELIVERY FEE (traveler price), not total payment
    // This is the policy: cancellation fee is % of delivery fee
    const cancellationFeePercent = Number(this.configService.get<number>('CANCELLATION_FEE_PERCENT')) || 10;
    const cancellationFeeMin = Number(this.configService.get<number>('CANCELLATION_FEE_MIN')) || 5;
    
    // For mobile money, calculate cancellation fee in transaction currency (XAF)
    // Convert delivery fee to transaction currency if needed
    let cancellationFeeBase = deliveryFee;
    if ((paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN') && refundCurrency !== currency) {
      // Convert delivery fee from request currency to transaction currency (XAF)
      // Using fixed rate: EUR to XAF = 680
      if (currency === 'EUR' && refundCurrency === 'XAF') {
        cancellationFeeBase = deliveryFee * 680;
      } else if (currency === 'USD' && refundCurrency === 'XAF') {
        cancellationFeeBase = deliveryFee * 600;
      } else if (currency === 'CAD' && refundCurrency === 'XAF') {
        cancellationFeeBase = deliveryFee * 450;
      }
    }
    
    let cancellationFee = (cancellationFeeBase * cancellationFeePercent) / 100;
    cancellationFee = Math.max(cancellationFee, cancellationFeeMin);

    // Refund amount = Actual payment amount - cancellation fee
    // This ensures we refund the correct amount that was actually charged
    const refundAmount = actualPaymentAmount - cancellationFee;

    // Validate refund amount is positive
    if (refundAmount <= 0) {
      throw new BadRequestException(
        `Refund amount would be negative. Actual payment: ${actualPaymentAmount}, Cancellation fee: ${cancellationFee}`
      );
    }

    // Split cancellation fee: configurable percentages
    const travelerCompensationPercent = Number(this.configService.get<number>('CANCELLATION_TRAVELER_PERCENT')) || 70;
    const velroFeePercent = Number(this.configService.get<number>('CANCELLATION_VELRO_PERCENT')) || 30;
    
    const travelerCompensation = (cancellationFee * travelerCompensationPercent) / 100;
    const velroFee = (cancellationFee * velroFeePercent) / 100;

    // Process cancellation/refund to sender based on payment provider
    if (request.payment_intent_id) {
      if (paymentInfo.provider === 'STRIPE' && paymentInfo.paymentIntentId) {
        // Stripe: refund through Stripe API
        await this.processStripeCancellationOrRefund(paymentInfo.paymentIntentId, refundAmount);
      } else if (paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN') {
        // Orange Money/MTN: refund to wallet (regardless of original payment method)
        if (!paymentInfo.transaction || !paymentInfo.transaction.id) {
          throw new BadRequestException(
            `Transaction information is required for ${paymentInfo.provider} refund but was not found`
          );
        }
        await this.refundToWallet(
          request.user_id,
          refundAmount,
          refundCurrency, // Use transaction currency (XAF) for mobile money
          request.id,
          paymentInfo.transaction.id,
        );
      } else {
        throw new BadRequestException(
          `Unsupported payment provider: ${paymentInfo.provider}. Supported: STRIPE, ORANGE, MTN`
        );
      }
    }

    // Release hold from traveler's wallet (remove full held amount)
    // Use transaction currency for mobile money
    const holdReleaseCurrency = (paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN')
      ? (paymentInfo.transaction?.currency || 'XAF').toUpperCase()
      : currency;
    try {
      await this.releaseHold(
        request.trip.user_id, 
        actualPaymentAmount, // Release the actual amount that was held (in transaction currency)
        holdReleaseCurrency, 
        request.id,
        paymentInfo.provider,
      );
    } catch (e) {
      this.logger.warn(`Failed to release hold for request ${request.id}: ${e.message}`);
    }

    // Credit traveler with compensation
    // Use transaction currency for mobile money compensation
    const compensationCurrency = (paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN')
      ? (paymentInfo.transaction?.currency || 'XAF').toUpperCase()
      : currency;
    if (travelerCompensation > 0) {
      await this.creditTravelerCompensation(
        request.trip.user_id, 
        travelerCompensation, 
        request.id, 
        compensationCurrency,
        paymentInfo.provider,
      );
      
      // Notify traveler about compensation
      try {
        const traveler = await this.prisma.user.findUnique({
          where: { id: request.trip.user_id },
          select: { lang: true, device_id: true },
        });
        const travelerLang = traveler?.lang || 'en';
        
        const compensationTitle = 'Cancellation Compensation';
        const compensationMessage = `The sender cancelled the request. You've received ${currency} ${travelerCompensation.toFixed(2)} as compensation.`;
        const compensationData = {
          type: 'cancellation_compensation',
          request_id: request.id,
          trip_id: request.trip_id,
          amount: travelerCompensation,
          currency: currency,
        };
        
        // Create in-app notification (always)
        await this.notificationService.createNotification(
          {
            user_id: request.trip.user_id,
            title: compensationTitle,
            message: compensationMessage,
            type: NotificationType.REQUEST,
            trip_id: request.trip_id,
            request_id: request.id,
            data: compensationData,
          },
          travelerLang,
        );
        
        // Send push notification if device_id exists
        if (traveler?.device_id) {
          await this.notificationService.sendPushNotificationToUser(
            request.trip.user_id,
            compensationTitle,
            compensationMessage,
            compensationData,
            travelerLang,
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to notify traveler about compensation: ${error.message}`);
      }
    }

    // Record Velro fee
    if (velroFee > 0) {
      await this.recordVelroFee(velroFee, request.id, currency);
    }

    // Get sender's language preference and device_id
    const sender = await this.prisma.user.findUnique({
      where: { id: request.user_id },
      select: { lang: true, device_id: true },
    });
    const senderLang = sender?.lang || 'en';
    
    // Notification data - message depends on payment provider
    const refundTitle = 'Refund Processed';
    const isWalletRefund = paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN';
    // Use refundCurrency for mobile money, currency for Stripe
    const notificationRefundCurrency = isWalletRefund ? refundCurrency : currency;
    const refundMessage = isWalletRefund
      ? `Your request has been cancelled. A refund of ${notificationRefundCurrency} ${refundAmount.toFixed(2)} has been added to your wallet (cancellation fee: ${notificationRefundCurrency} ${cancellationFee.toFixed(2)}).`
      : `Your request has been cancelled. A refund of ${currency} ${refundAmount.toFixed(2)} will be processed to your payment method (cancellation fee: ${currency} ${cancellationFee.toFixed(2)}).`;
    const refundData = {
      type: 'refund_processed',
      request_id: request.id,
      trip_id: request.trip_id,
      refund_amount: refundAmount,
      cancellation_fee: cancellationFee,
      currency: notificationRefundCurrency,
      refund_method: isWalletRefund ? 'WALLET' : 'PAYMENT_METHOD',
    };
    
    // Create in-app notification and send push notification to sender about refund
    try {
      // Create in-app notification (always)
      await this.notificationService.createNotification(
        {
          user_id: request.user_id, // sender
          title: refundTitle,
          message: refundMessage,
          type: NotificationType.REQUEST,
          trip_id: request.trip_id,
          request_id: request.id,
          data: refundData,
        },
        senderLang,
      );
      
      // Send push notification if device_id exists
      if (sender?.device_id) {
        await this.notificationService.sendPushNotificationToUser(
          request.user_id, // sender
          refundTitle,
          refundMessage,
          refundData,
          senderLang,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to create/send refund notification: ${error.message}`);
      // Don't fail the cancellation if notification fails
    }

    return {
      requestId: request.id,
      cancellationType: CancellationType.SENDER_CANCEL,
      refundAmount,
      cancellationFee,
      travelerCompensation,
      velroFee,
      currency: refundCurrency, // Return the currency actually used for refund
      status: 'CANCELLED',
      cancelledAt: new Date(),
    };
  }

  /**
   * Traveler cancels before payment - no fees, no refunds needed
   */
  private async handleTravelerCancelBeforePayment(request: any) {
    this.logger.log(`Traveler cancelled before payment for request ${request.id}`);

    return {
      requestId: request.id,
      cancellationType: CancellationType.TRAVELER_CANCEL,
      refundAmount: 0,
      cancellationFee: 0,
      travelerCompensation: 0,
      velroFee: 0,
      status: 'CANCELLED',
      cancelledAt: new Date(),
    };
  }

  /**
   * Traveler cancels after payment - full refund to sender
   */
  private async handleTravelerCancelAfterPayment(request: any, deliveryFee: number, currency: string) {
    this.logger.log(`Traveler cancelled after payment for request ${request.id}`);

    // Validate payment_intent_id exists for paid requests
    if (!request.payment_intent_id) {
      throw new BadRequestException(
        `Payment intent ID is missing for paid request ${request.id}. ` +
        `Cannot process refund without payment information.`
      );
    }

    // Get payment information to determine provider
    const paymentInfo = await this.getPaymentInfo(request.payment_intent_id);

    // Get actual payment amount based on provider
    let actualPaymentAmount = deliveryFee;
    if (paymentInfo.provider === 'STRIPE' && paymentInfo.paymentIntentId) {
      const paymentIntent = await this.stripeService.getPaymentIntent(paymentInfo.paymentIntentId);
        // PaymentIntent amount is in cents, convert to currency units
        actualPaymentAmount = paymentIntent.amount / 100;
        this.logger.log(
          `Actual payment amount from Stripe: ${actualPaymentAmount} ${paymentIntent.currency.toUpperCase()}, ` +
          `Delivery fee (traveler price): ${deliveryFee} ${currency}`
        );
    } else if (paymentInfo.transaction) {
      // For mobile money, use transaction amount
      actualPaymentAmount = Number(paymentInfo.transaction.amount_requested);
      // Use transaction currency for mobile money refunds (not request currency)
      const transactionCurrency = (paymentInfo.transaction.currency || 'XAF').toUpperCase();
      this.logger.log(
        `Actual payment amount from transaction: ${actualPaymentAmount} ${transactionCurrency}, ` +
        `Delivery fee (traveler price): ${deliveryFee} ${currency}`
      );
    }

    // For mobile money, use transaction currency for refunds; for Stripe, use request currency
    const refundCurrency = (paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN') 
      ? (paymentInfo.transaction?.currency || 'XAF').toUpperCase()
      : currency;

    // Full refund of actual payment amount to sender based on payment provider
    if (request.payment_intent_id) {
      if (paymentInfo.provider === 'STRIPE' && paymentInfo.paymentIntentId) {
        // Stripe: refund through Stripe API
        await this.processStripeCancellationOrRefund(paymentInfo.paymentIntentId, actualPaymentAmount);
      } else if (paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN') {
        // Orange Money/MTN: refund to wallet (regardless of original payment method)
        if (!paymentInfo.transaction || !paymentInfo.transaction.id) {
          throw new BadRequestException(
            `Transaction information is required for ${paymentInfo.provider} refund but was not found`
          );
        }
        await this.refundToWallet(
          request.user_id,
          actualPaymentAmount,
          refundCurrency, // Use transaction currency (XAF) for mobile money
          request.id,
          paymentInfo.transaction.id,
        );
      } else {
        throw new BadRequestException(
          `Unsupported payment provider: ${paymentInfo.provider}. Supported: STRIPE, ORANGE, MTN`
        );
      }
    }

    // Release any hold from traveler's wallet
    // Use transaction currency for mobile money
    const holdReleaseCurrency = (paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN')
      ? (paymentInfo.transaction?.currency || 'XAF').toUpperCase()
      : currency;
    try {
      await this.releaseHold(
        request.trip.user_id, 
        actualPaymentAmount, // Release the actual amount that was held (in transaction currency)
        holdReleaseCurrency, 
        request.id,
        paymentInfo.provider,
      );
      
      // Notify traveler about hold release
      try {
        const traveler = await this.prisma.user.findUnique({
          where: { id: request.trip.user_id },
          select: { lang: true, device_id: true },
        });
        const travelerLang = traveler?.lang || 'en';
        
        const holdReleaseTitle = 'Request Cancelled';
        const holdReleaseMessage = `You cancelled the request. The hold of ${holdReleaseCurrency} ${actualPaymentAmount.toFixed(2)} has been released from your wallet.`;
        const holdReleaseData = {
          type: 'hold_released',
          request_id: request.id,
          trip_id: request.trip_id,
          amount: actualPaymentAmount,
          currency: holdReleaseCurrency, // Use hold release currency (transaction currency for mobile money)
        };
        
        // Create in-app notification (always)
        await this.notificationService.createNotification(
          {
            user_id: request.trip.user_id,
            title: holdReleaseTitle,
            message: holdReleaseMessage,
            type: NotificationType.REQUEST,
            trip_id: request.trip_id,
            request_id: request.id,
            data: holdReleaseData,
          },
          travelerLang,
        );
        
        // Send push notification if device_id exists
        if (traveler?.device_id) {
          await this.notificationService.sendPushNotificationToUser(
            request.trip.user_id,
            holdReleaseTitle,
            holdReleaseMessage,
            holdReleaseData,
            travelerLang,
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to notify traveler about hold release: ${error.message}`);
      }
    } catch (e) {
      this.logger.warn(`Failed to release hold for request ${request.id}: ${e.message}`);
    }

    // Get sender's language preference and device_id
    const sender = await this.prisma.user.findUnique({
      where: { id: request.user_id },
      select: { lang: true, device_id: true },
    });
    const senderLang = sender?.lang || 'en';
    
    // Notification data - message depends on payment provider
    const refundTitle = 'Full Refund Processed';
    const isWalletRefund = paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN';
    const refundMessage = isWalletRefund
      ? `The traveler cancelled your request. A full refund of ${refundCurrency} ${actualPaymentAmount.toFixed(2)} has been added to your wallet.`
      : `The traveler cancelled your request. A full refund of ${refundCurrency} ${actualPaymentAmount.toFixed(2)} will be processed to your payment method.`;
    const refundData = {
      type: 'refund_processed',
      request_id: request.id,
      trip_id: request.trip_id,
      refund_amount: actualPaymentAmount,
      cancellation_fee: 0,
      currency: refundCurrency, // Use refund currency (transaction currency for mobile money)
      refund_method: isWalletRefund ? 'WALLET' : 'PAYMENT_METHOD',
    };
    
    // Create in-app notification and send push notification to sender about full refund
    try {
      // Create in-app notification (always)
      await this.notificationService.createNotification(
        {
          user_id: request.user_id, // sender
          title: refundTitle,
          message: refundMessage,
          type: NotificationType.REQUEST,
          trip_id: request.trip_id,
          request_id: request.id,
          data: refundData,
        },
        senderLang,
      );
      
      // Send push notification if device_id exists
      if (sender?.device_id) {
        await this.notificationService.sendPushNotificationToUser(
          request.user_id, // sender
          refundTitle,
          refundMessage,
          refundData,
          senderLang,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to create/send refund notification: ${error.message}`);
      // Don't fail the cancellation if notification fails
    }

    return {
      requestId: request.id,
      cancellationType: CancellationType.TRAVELER_CANCEL,
      refundAmount: actualPaymentAmount,
      cancellationFee: 0,
      travelerCompensation: 0,
      velroFee: 0,
      currency: refundCurrency, // Use refund currency (transaction currency for mobile money)
      status: 'CANCELLED',
      cancelledAt: new Date(),
    };
  }

  /**
   * System/Error cancellation - full refund
   */
  private async handleSystemCancellation(request: any, deliveryFee: number, cancellationType: CancellationType, currency: string) {
    this.logger.log(`System cancellation (${cancellationType}) for request ${request.id}`);

    // For system cancellations, payment_intent_id might not exist (e.g., unpaid requests)
    // Only process refunds if payment was made
    if (!request.payment_intent_id) {
      this.logger.log(`No payment_intent_id for system cancellation ${request.id}, skipping refund`);
      return {
        requestId: request.id,
        cancellationType,
        refundAmount: 0,
        cancellationFee: 0,
        travelerCompensation: 0,
        velroFee: 0,
        currency,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      };
    }

    // Get payment information to determine provider
    const paymentInfo = await this.getPaymentInfo(request.payment_intent_id);

    // Get actual payment amount based on provider
    let actualPaymentAmount = deliveryFee;
    if (paymentInfo.provider === 'STRIPE' && paymentInfo.paymentIntentId) {
      const paymentIntent = await this.stripeService.getPaymentIntent(paymentInfo.paymentIntentId);
        // PaymentIntent amount is in cents, convert to currency units
        actualPaymentAmount = paymentIntent.amount / 100;
        this.logger.log(
          `Actual payment amount from Stripe: ${actualPaymentAmount} ${paymentIntent.currency.toUpperCase()}, ` +
          `Delivery fee (traveler price): ${deliveryFee} ${currency}`
        );
    } else if (paymentInfo.transaction) {
      // For mobile money, use transaction amount
      actualPaymentAmount = Number(paymentInfo.transaction.amount_requested);
      this.logger.log(
        `Actual payment amount from transaction: ${actualPaymentAmount} ${currency}, ` +
        `Delivery fee (traveler price): ${deliveryFee} ${currency}`
      );
    }

    // Full refund of actual payment amount to sender based on payment provider
    if (request.payment_intent_id) {
      if (paymentInfo.provider === 'STRIPE' && paymentInfo.paymentIntentId) {
        // Stripe: refund through Stripe API
        await this.processStripeCancellationOrRefund(paymentInfo.paymentIntentId, actualPaymentAmount);
      } else if (paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN') {
        // Orange Money/MTN: refund to wallet (regardless of original payment method)
        if (!paymentInfo.transaction || !paymentInfo.transaction.id) {
          throw new BadRequestException(
            `Transaction information is required for ${paymentInfo.provider} refund but was not found`
          );
        }
        await this.refundToWallet(
          request.user_id,
          actualPaymentAmount,
          currency,
          request.id,
          paymentInfo.transaction.id,
        );
      } else {
        throw new BadRequestException(
          `Unsupported payment provider: ${paymentInfo.provider}. Supported: STRIPE, ORANGE, MTN`
        );
      }
    }

    // Release any hold from traveler's wallet
    try {
      await this.releaseHold(
        request.trip.user_id, 
        deliveryFee, 
        currency, 
        request.id,
        paymentInfo.provider,
      );
      
      // Notify traveler about hold release
      try {
        const traveler = await this.prisma.user.findUnique({
          where: { id: request.trip.user_id },
          select: { lang: true, device_id: true },
        });
        const travelerLang = traveler?.lang || 'en';
        
        const holdReleaseTitle = 'Request Cancelled';
        const holdReleaseMessage = `The request has been cancelled by the system. The hold of ${currency} ${deliveryFee.toFixed(2)} has been released from your wallet.`;
        const holdReleaseData = {
          type: 'hold_released',
          request_id: request.id,
          trip_id: request.trip_id,
          amount: deliveryFee,
          currency: currency,
        };
        
        // Create in-app notification (always)
        await this.notificationService.createNotification(
          {
            user_id: request.trip.user_id,
            title: holdReleaseTitle,
            message: holdReleaseMessage,
            type: NotificationType.REQUEST,
            trip_id: request.trip_id,
            request_id: request.id,
            data: holdReleaseData,
          },
          travelerLang,
        );
        
        // Send push notification if device_id exists
        if (traveler?.device_id) {
          await this.notificationService.sendPushNotificationToUser(
            request.trip.user_id,
            holdReleaseTitle,
            holdReleaseMessage,
            holdReleaseData,
            travelerLang,
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to notify traveler about hold release: ${error.message}`);
      }
    } catch (e) {
      this.logger.warn(`Failed to release hold for request ${request.id}: ${e.message}`);
    }

    // Get sender's language preference and device_id
    const sender = await this.prisma.user.findUnique({
      where: { id: request.user_id },
      select: { lang: true, device_id: true },
    });
    const senderLang = sender?.lang || 'en';
    
    // Notification data - message depends on payment provider
    const refundTitle = 'Refund Processed';
    const isWalletRefund = paymentInfo.provider === 'ORANGE' || paymentInfo.provider === 'MTN';
    const refundMessage = isWalletRefund
      ? `Your request has been cancelled by the system. A full refund of ${currency} ${actualPaymentAmount.toFixed(2)} has been added to your wallet.`
      : `Your request has been cancelled by the system. A full refund of ${currency} ${actualPaymentAmount.toFixed(2)} will be processed to your payment method.`;
    const refundData = {
      type: 'refund_processed',
      request_id: request.id,
      trip_id: request.trip_id,
      refund_amount: actualPaymentAmount,
      cancellation_fee: 0,
      currency: currency,
      refund_method: isWalletRefund ? 'WALLET' : 'PAYMENT_METHOD',
    };
    
    // Create in-app notification and send push notification to sender about refund
    try {
      // Create in-app notification (always)
      await this.notificationService.createNotification(
        {
          user_id: request.user_id, // sender
          title: refundTitle,
          message: refundMessage,
          type: NotificationType.REQUEST,
          trip_id: request.trip_id,
          request_id: request.id,
          data: refundData,
        },
        senderLang,
      );
      
      // Send push notification if device_id exists
      if (sender?.device_id) {
        await this.notificationService.sendPushNotificationToUser(
          request.user_id, // sender
          refundTitle,
          refundMessage,
          refundData,
          senderLang,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to create/send refund notification: ${error.message}`);
      // Don't fail the cancellation if notification fails
    }

    return {
      requestId: request.id,
      cancellationType,
      refundAmount: actualPaymentAmount,
      cancellationFee: 0,
      travelerCompensation: 0,
      velroFee: 0,
      currency,
      status: 'CANCELLED',
      cancelledAt: new Date(),
    };
  }

  /**
   * Get payment transaction and provider information
   * Throws error if payment provider cannot be determined
   */
  private async getPaymentInfo(paymentIntentId: string): Promise<{
    provider: 'STRIPE' | 'ORANGE' | 'MTN';
    transaction: any;
    paymentIntentId: string | null; // Stripe PaymentIntent ID if Stripe, null otherwise
  }> {
    if (!paymentIntentId) {
      throw new BadRequestException('Payment intent ID is required to determine payment provider');
    }

    // Check if it's a Stripe ID (starts with pi_, ch_, pay_, etc.)
    const isStripeId = paymentIntentId.startsWith('pi_') || 
                       paymentIntentId.startsWith('ch_') || 
                       paymentIntentId.startsWith('pay_');

    if (isStripeId) {
      // It's a Stripe PaymentIntent ID
      this.logger.log(`Payment method detected as Stripe: ${paymentIntentId}`);
      return { provider: 'STRIPE', transaction: null, paymentIntentId };
    }

    // Try to get transaction from database (mobile money uses Transaction ID as payment_intent_id)
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: paymentIntentId },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction not found for payment_intent_id: ${paymentIntentId}. ` +
        `Cannot determine payment provider.`
      );
    }

    if (!transaction.provider) {
      throw new BadRequestException(
        `Transaction ${transaction.id} does not have a provider. ` +
        `Cannot process refund without knowing the payment method.`
      );
    }

    const provider = transaction.provider as 'STRIPE' | 'ORANGE' | 'MTN';
    
    if (provider !== 'STRIPE' && provider !== 'ORANGE' && provider !== 'MTN') {
      throw new BadRequestException(
        `Invalid payment provider: ${transaction.provider}. ` +
        `Supported providers: STRIPE, ORANGE, MTN`
      );
    }

    this.logger.log(`Payment method detected as ${provider} from transaction ${transaction.id}`);
    return { provider, transaction, paymentIntentId: transaction.provider_id || null };
  }

  /**
   * Process Stripe cancellation or refund (smart method)
   */
  private async processStripeCancellationOrRefund(paymentIntentId: string, amount: number) {
    try {
      this.logger.log(`Processing Stripe cancellation/refund for ${paymentIntentId}: €${amount}`);
      
      // Use smart method that determines whether to cancel or refund
      const result = await this.stripeService.processCancellationOrRefund(paymentIntentId, amount);
      
      this.logger.log(`${result.type} processed: ${result.result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process cancellation/refund: ${error.message}`);
      throw new BadRequestException(`Cancellation/refund failed: ${error.message}`);
    }
  }

  /**
   * Refund to sender's wallet (for Orange Money/MTN payments)
   * Uses database transaction to ensure atomicity
   */
  private async refundToWallet(
    senderId: string,
    amount: number,
    currency: string,
    requestId: string,
    originalTransactionId: string,
  ) {
    try {
      this.logger.log(`Refunding ${currency} ${amount} to sender ${senderId}'s wallet`);

      // Get original transaction to use its provider (before transaction)
      const originalTx = await this.prisma.transaction.findUnique({
        where: { id: originalTransactionId },
        select: { provider: true },
      });

      if (!originalTx) {
        throw new NotFoundException(
          `Original transaction ${originalTransactionId} not found. Cannot determine provider.`
        );
      }

      if (!originalTx.provider) {
        throw new BadRequestException(
          `Original transaction ${originalTransactionId} does not have a provider. ` +
          `Cannot create refund transaction without provider information.`
        );
      }

      const originalProvider = originalTx.provider as 'STRIPE' | 'ORANGE' | 'MTN';

      if (originalProvider !== 'STRIPE' && originalProvider !== 'ORANGE' && originalProvider !== 'MTN') {
        throw new BadRequestException(
          `Invalid provider in original transaction: ${originalTx.provider}. ` +
          `Supported providers: STRIPE, ORANGE, MTN`
        );
      }

      // Perform wallet update and transaction creation atomically
      await this.prisma.$transaction(async (prisma) => {
        // Get or create sender's wallet
        let wallet = await prisma.wallet.findUnique({
          where: { userId: senderId },
        });

        if (!wallet) {
          // Create wallet if it doesn't exist
          wallet = await prisma.wallet.create({
            data: {
              userId: senderId,
              currency: currency,
            },
          });
          this.logger.log(`Created wallet for sender ${senderId}`);
        }

        const { availableColumn } = this.getCurrencyColumns(currency);
        
        // Get current balance within transaction to avoid race conditions
        const walletWithBalance = await prisma.wallet.findUnique({
          where: { id: wallet.id },
        });
        
        if (!walletWithBalance) {
          throw new NotFoundException(`Wallet ${wallet.id} not found during transaction`);
        }

        const currentBalance = this.getWalletCurrencyBalance(walletWithBalance, currency);
        const newBalance = currentBalance + amount;

        // Credit the refund amount to sender's wallet
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            [availableColumn]: {
              increment: amount,
            },
          } as any,
        });

        // Record refund transaction (atomic with wallet update)
        await prisma.transaction.create({
          data: {
            userId: senderId,
            wallet_id: wallet.id,
            type: 'CREDIT',
            source: 'REFUND',
            amount_requested: amount,
            fee_applied: 0,
            amount_paid: amount,
            currency: currency,
            request_id: requestId,
            status: 'SUCCESS',
            provider: originalProvider,
            description: `Refund for cancelled request ${requestId}`,
            balance_after: newBalance,
            metadata: {
              originalTransactionId,
              refundType: 'CANCELLATION',
            },
          },
        });
      });

      this.logger.log(`Refund credited to wallet successfully`);
    } catch (error) {
      this.logger.error(`Failed to refund to wallet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Credit traveler with compensation
   * Uses database transaction to ensure atomicity
   */
  private async creditTravelerCompensation(
    travelerId: string, 
    amount: number, 
    requestId: string, 
    currency: string,
    provider: 'STRIPE' | 'ORANGE' | 'MTN',
  ) {
    try {
      this.logger.log(`Crediting traveler ${travelerId} with ${currency} ${amount} compensation`);

      // Perform wallet update and transaction creation atomically
      await this.prisma.$transaction(async (prisma) => {
      // Wallet should already exist if payment was made - find it or throw error
        const wallet = await prisma.wallet.findUnique({
        where: { userId: travelerId },
      });

      if (!wallet) {
        // Wallet should exist if payment was made - this indicates a data integrity issue
        this.logger.error(
          `Wallet not found for traveler ${travelerId} during cancellation compensation. ` +
          `This should not happen if payment was successful.`
        );
        throw new NotFoundException(
          `Traveler wallet not found. This indicates a data integrity issue.`
        );
      }

      // Resolve balance column by currency
      const { availableColumn } = this.getCurrencyColumns(currency);

        // Get current balance within transaction to avoid race conditions
        const walletWithBalance = await prisma.wallet.findUnique({
          where: { id: wallet.id },
        });

        if (!walletWithBalance) {
          throw new NotFoundException(`Wallet ${wallet.id} not found during transaction`);
        }

        const currentBalance = this.getWalletCurrencyBalance(walletWithBalance, currency);
        const newBalance = currentBalance + amount;

      // Add compensation to available balance in the specific currency
        await prisma.wallet.update({
        where: { userId: travelerId },
        data: {
          [availableColumn]: {
            increment: amount,
          },
        } as any,
      });

        // Record transaction with correct provider (atomic with wallet update)
        await prisma.transaction.create({
        data: {
          userId: travelerId,
          type: 'CREDIT',
          amount_requested: amount,
          fee_applied: 0,
          amount_paid: amount,
          wallet_id: wallet.id,
            request_id: requestId,
          currency: currency,
          description: `Cancellation compensation for request ${requestId}`,
          source: 'CANCELLATION_COMPENSATION',
            balance_after: newBalance,
            provider: provider,
        },
        });
      });

      this.logger.log(`Traveler compensation credited successfully`);
    } catch (error) {
      this.logger.error(`Failed to credit traveler compensation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Record Velro fee
   */
  private async recordVelroFee(amount: number, requestId: string, currency: string) {
    try {
      this.logger.log(`Recording Velro fee: ${currency} ${amount} for request ${requestId}`);

      // For system fees, we'll create a transaction record without a specific wallet
      // This is for tracking purposes only
      try {
        // Get the first admin user to use as system user
        const adminUser = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          include: { wallet: true },
        });

        if (adminUser && adminUser.wallet) {
          const { availableColumn } = this.getCurrencyColumns(currency);
          const currentBalance = this.getWalletCurrencyBalance(adminUser.wallet, currency);
          await this.prisma.transaction.create({
            data: {
              userId: adminUser.id,
              type: 'CREDIT',
              amount_requested: amount,
              fee_applied: 0,
              amount_paid: amount,
              wallet_id: adminUser.wallet.id,
              currency: currency,
              description: `Velro cancellation fee for request ${requestId}`,
              source: 'VELRO_FEE',
              balance_after: currentBalance + amount,
              provider: 'STRIPE',
            },
          });
        }
      } catch (error) {
        this.logger.warn(`Could not record Velro fee transaction: ${error.message}`);
        // Continue without failing the cancellation
      }

      this.logger.log(`Velro fee recorded successfully`);
    } catch (error) {
      this.logger.error(`Failed to record Velro fee: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helpers: map currency to wallet columns and compute balances
   */
  private getCurrencyColumns(currency: string): { availableColumn: string; holdColumn: string } {
    const c = (currency || 'EUR').toUpperCase();
    switch (c) {
      case 'XAF':
        return { availableColumn: 'available_balance_xaf', holdColumn: 'hold_balance_xaf' };
      case 'USD':
        return { availableColumn: 'available_balance_usd', holdColumn: 'hold_balance_usd' };
      case 'CAD':
        return { availableColumn: 'available_balance_cad', holdColumn: 'hold_balance_cad' };
      case 'EUR':
      default:
        return { availableColumn: 'available_balance_eur', holdColumn: 'hold_balance_eur' };
    }
  }

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

  private computeBalanceAfter(wallet: any, currency: string, delta: number): number {
    return this.getWalletCurrencyBalance(wallet, currency) + Number(delta || 0);
  }

  /**
   * Release held earnings from traveler's wallet for a cancelled request
   */
  private async releaseHold(
    travelerId: string, 
    amount: number, 
    currency: string, 
    requestId: string,
    provider: 'STRIPE' | 'ORANGE' | 'MTN',
  ) {
    if (!amount || amount <= 0) return;
    
    // Wallet should already exist if payment was made - find it or throw error
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: travelerId },
    });

    if (!wallet) {
      // Wallet should exist if payment was made - this indicates a data integrity issue
      this.logger.error(
        `Wallet not found for traveler ${travelerId} during cancellation. ` +
        `This should not happen if payment was successful.`
      );
      throw new NotFoundException(
        `Traveler wallet not found. This indicates a data integrity issue.`
      );
    }

    const { holdColumn } = this.getCurrencyColumns(currency);

    // Decrement hold by the full delivery fee
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        [holdColumn]: {
          decrement: amount,
        },
      } as any,
    });

    // Optional: record an audit transaction for hold release (no funds move to available)
    await this.prisma.transaction.create({
      data: {
        userId: travelerId,
        wallet_id: wallet.id,
        type: 'DEBIT',
        source: 'PAYMENT_CANCELLATION',
        amount_requested: amount,
        fee_applied: 0,
        amount_paid: amount,
        currency,
        request_id: requestId,
        status: 'SUCCESS',
        provider: provider,
        description: `Hold released due to cancellation for request ${requestId}`,
        balance_after: Number(wallet[holdColumn]) - amount,
      },
    });
  }
}
