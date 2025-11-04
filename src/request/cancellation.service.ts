import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { StripeService } from '../payment/stripe.service';
import { WalletService } from '../wallet/wallet.service';
import { 
  CancelRequestDto, 
  CancellationType,
  UnpaidCancellationReason,
  PaidCancellationReason,
} from './dto/cancel-request.dto';
import { RequestStatus, PaymentStatus } from 'generated/prisma';

@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Cancel a trip request with proper fee distribution
   */
  async cancelRequest(
    requestId: string,
    cancellationDto: CancelRequestDto,
    userId: string,
  ) {
    this.logger.log(`Processing cancellation for request ${requestId}`);

    // Get request with all related data
    const request = await this.prisma.tripRequest.findUnique({
      where: { id: requestId },
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

    // Validate cancellation reason based on actual payment status from database
    this.validateCancellationReason(isPaid, cancellationDto.reason);

    // Check if already cancelled
    if (request.status === RequestStatus.CANCELLED) {
      throw new BadRequestException('Request is already cancelled');
    }

    // IDEMPOTENCY: Check if refund already processed for paid requests
    if (request.payment_intent_id && request.payment_status === PaymentStatus.SUCCEEDED) {
      try {
        const paymentIntent = await this.stripeService.getPaymentIntent(request.payment_intent_id);
        if (paymentIntent.status === 'succeeded' && paymentIntent.latest_charge) {
          const charge = await this.stripeService.getStripeInstance().charges.retrieve(
            paymentIntent.latest_charge as string
          );
          // If already fully or partially refunded, check if request status wasn't updated
          if (charge.amount_refunded > 0) {
            const refundedAmount = charge.amount_refunded / 100;
            const totalAmount = charge.amount / 100;
            this.logger.warn(
              `Request ${requestId} already has refund: ${refundedAmount}/${totalAmount}. ` +
              `Status may not have been updated. Checking...`
            );
            
            // If fully refunded, mark as cancelled
            if (charge.amount_refunded === charge.amount) {
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
        this.logger.warn(`Could not check refund status: ${error.message}`);
      }
    }

    // Update request status to CANCELLED BEFORE processing refund
    // This prevents duplicate refunds if processCancellation fails after refund
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

    // Process cancellation based on type and payment status from database
    // Status is already CANCELLED, so if this fails, retry will be blocked
    const cancellationResult = await this.processCancellation(request, cancellationType, cancellationDto);

    this.logger.log(`Cancellation completed for request ${requestId}`);
    return cancellationResult;
  }

  /**
   * Validate cancellation reason based on payment status from database
   */
  private validateCancellationReason(isPaid: boolean, reason?: string) {
    if (!reason) {
      return; // Reason is optional
    }

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

    // Get actual payment amount from Stripe (includes platform fees)
    let actualPaymentAmount = deliveryFee;
    if (request.payment_intent_id) {
      try {
        const paymentIntent = await this.stripeService.getPaymentIntent(request.payment_intent_id);
        // PaymentIntent amount is in cents, convert to currency units
        actualPaymentAmount = paymentIntent.amount / 100;
        this.logger.log(
          `Actual payment amount from Stripe: ${actualPaymentAmount} ${paymentIntent.currency.toUpperCase()}, ` +
          `Delivery fee (traveler price): ${deliveryFee} ${currency}`
        );
      } catch (error) {
        this.logger.warn(`Failed to get PaymentIntent amount, using deliveryFee: ${error.message}`);
        // Fallback to deliveryFee if we can't get PaymentIntent
        actualPaymentAmount = deliveryFee;
      }
    }

    // Calculate cancellation fee based on DELIVERY FEE (traveler price), not total payment
    // This is the policy: cancellation fee is % of delivery fee
    const cancellationFeePercent = Number(this.configService.get<number>('CANCELLATION_FEE_PERCENT')) || 10;
    const cancellationFeeMin = Number(this.configService.get<number>('CANCELLATION_FEE_MIN')) || 5;
    
    let cancellationFee = (deliveryFee * cancellationFeePercent) / 100;
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

    // Process cancellation/refund to sender
    if (request.payment_intent_id) {
      await this.processStripeCancellationOrRefund(request.payment_intent_id, refundAmount);
    }

    // Release hold from traveler's wallet (remove full held amount)
    try {
      await this.releaseHold(request.trip.user_id, deliveryFee, currency, request.id);
    } catch (e) {
      this.logger.warn(`Failed to release hold for request ${request.id}: ${e.message}`);
    }

    // Credit traveler with compensation
    if (travelerCompensation > 0) {
      await this.creditTravelerCompensation(request.trip.user_id, travelerCompensation, request.id, currency);
    }

    // Record Velro fee
    if (velroFee > 0) {
      await this.recordVelroFee(velroFee, request.id, currency);
    }

    return {
      requestId: request.id,
      cancellationType: CancellationType.SENDER_CANCEL,
      refundAmount,
      cancellationFee,
      travelerCompensation,
      velroFee,
      currency,
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

    // Get actual payment amount from Stripe (includes platform fees)
    let actualPaymentAmount = deliveryFee;
    if (request.payment_intent_id) {
      try {
        const paymentIntent = await this.stripeService.getPaymentIntent(request.payment_intent_id);
        // PaymentIntent amount is in cents, convert to currency units
        actualPaymentAmount = paymentIntent.amount / 100;
        this.logger.log(
          `Actual payment amount from Stripe: ${actualPaymentAmount} ${paymentIntent.currency.toUpperCase()}, ` +
          `Delivery fee (traveler price): ${deliveryFee} ${currency}`
        );
      } catch (error) {
        this.logger.warn(`Failed to get PaymentIntent amount, using deliveryFee: ${error.message}`);
        // Fallback to deliveryFee if we can't get PaymentIntent
        actualPaymentAmount = deliveryFee;
      }
    }

    // Full refund of actual payment amount to sender
    if (request.payment_intent_id) {
      await this.processStripeCancellationOrRefund(request.payment_intent_id, actualPaymentAmount);
    }

    // Release any hold from traveler's wallet
    try {
      await this.releaseHold(request.trip.user_id, deliveryFee, currency, request.id);
    } catch (e) {
      this.logger.warn(`Failed to release hold for request ${request.id}: ${e.message}`);
    }

    return {
      requestId: request.id,
      cancellationType: CancellationType.TRAVELER_CANCEL,
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
   * System/Error cancellation - full refund
   */
  private async handleSystemCancellation(request: any, deliveryFee: number, cancellationType: CancellationType, currency: string) {
    this.logger.log(`System cancellation (${cancellationType}) for request ${request.id}`);

    // Get actual payment amount from Stripe (includes platform fees)
    let actualPaymentAmount = deliveryFee;
    if (request.payment_intent_id) {
      try {
        const paymentIntent = await this.stripeService.getPaymentIntent(request.payment_intent_id);
        // PaymentIntent amount is in cents, convert to currency units
        actualPaymentAmount = paymentIntent.amount / 100;
        this.logger.log(
          `Actual payment amount from Stripe: ${actualPaymentAmount} ${paymentIntent.currency.toUpperCase()}, ` +
          `Delivery fee (traveler price): ${deliveryFee} ${currency}`
        );
      } catch (error) {
        this.logger.warn(`Failed to get PaymentIntent amount, using deliveryFee: ${error.message}`);
        // Fallback to deliveryFee if we can't get PaymentIntent
        actualPaymentAmount = deliveryFee;
      }
    }

    // Full refund of actual payment amount to sender
    if (request.payment_intent_id) {
      await this.processStripeCancellationOrRefund(request.payment_intent_id, actualPaymentAmount);
    }

    // Release any hold from traveler's wallet
    try {
      await this.releaseHold(request.trip.user_id, deliveryFee, currency, request.id);
    } catch (e) {
      this.logger.warn(`Failed to release hold for request ${request.id}: ${e.message}`);
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
   * Credit traveler with compensation
   */
  private async creditTravelerCompensation(travelerId: string, amount: number, requestId: string, currency: string) {
    try {
      this.logger.log(`Crediting traveler ${travelerId} with ${currency} ${amount} compensation`);

      // Wallet should already exist if payment was made - find it or throw error
      const wallet = await this.prisma.wallet.findUnique({
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

      // Add compensation to available balance in the specific currency
      await this.prisma.wallet.update({
        where: { userId: travelerId },
        data: {
          [availableColumn]: {
            increment: amount,
          },
        } as any,
      });

      // Record transaction
      await this.prisma.transaction.create({
        data: {
          userId: travelerId,
          type: 'CREDIT',
          amount_requested: amount,
          fee_applied: 0,
          amount_paid: amount,
          wallet_id: wallet.id,
          currency: currency,
          description: `Cancellation compensation for request ${requestId}`,
          source: 'CANCELLATION_COMPENSATION',
          balance_after: this.computeBalanceAfter(wallet, currency, amount),
          provider: 'STRIPE',
        },
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
  private async releaseHold(travelerId: string, amount: number, currency: string, requestId: string) {
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
        provider: 'STRIPE',
        description: `Hold released due to cancellation for request ${requestId}`,
        balance_after: Number(wallet[holdColumn]) - amount,
      },
    });
  }
}
