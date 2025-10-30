import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { StripeService } from '../payment/stripe.service';
import { WalletService } from '../wallet/wallet.service';
import { 
  CancelRequestDto, 
  CancellationType 
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

    // Validate cancellation permissions
    await this.validateCancellationPermission(request, userId, cancellationDto.cancellationType);

    // Check if already cancelled
    if (request.status === RequestStatus.CANCELLED) {
      throw new BadRequestException('Request is already cancelled');
    }

    // Process cancellation based on type and payment status
    const cancellationResult = await this.processCancellation(request, cancellationDto);

    // Update request status with cancellation details
    await this.prisma.tripRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.CANCELLED,
        cancelled_at: new Date(),
        cancellation_type: cancellationDto.cancellationType,
        cancellation_reason: cancellationDto.reason,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Cancellation completed for request ${requestId}`);
    return cancellationResult;
  }

  /**
   * Validate if user can cancel the request
   */
  private async validateCancellationPermission(
    request: any,
    userId: string,
    cancellationType: CancellationType,
  ) {
    const isSender = request.user_id === userId;
    const isTraveler = request.trip.user_id === userId;

    switch (cancellationType) {
      case CancellationType.SENDER_CANCEL:
        if (!isSender) {
          throw new BadRequestException('Only the sender can cancel their request');
        }
        break;

      case CancellationType.TRAVELER_CANCEL:
        if (!isTraveler) {
          throw new BadRequestException('Only the traveler can cancel their trip');
        }
        break;

      case CancellationType.MUTUAL_CANCEL:
        if (!isSender && !isTraveler) {
          throw new BadRequestException('Only sender or traveler can initiate mutual cancellation');
        }
        break;

      case CancellationType.SYSTEM_ERROR:
      case CancellationType.FRAUD_DISPUTE:
      case CancellationType.TRAVELER_UNRESPONSIVE:
        // These can be initiated by system/admin
        break;

      default:
        throw new BadRequestException('Invalid cancellation type');
    }
  }

  /**
   * Process cancellation with fee calculations
   */
  private async processCancellation(request: any, cancellationDto: CancelRequestDto) {
    const { cancellationType } = cancellationDto;
    const deliveryFee = Number(request.cost || 0);
    // Ensure currency is present on request for downstream operations
    if (!request.currency && request.trip?.currency) {
      request.currency = request.trip.currency;
    }
    const paymentStatus = request.payment_status;

    // Case 1: Sender cancels before payment
    if (cancellationType === CancellationType.SENDER_CANCEL && 
        (!paymentStatus || paymentStatus === PaymentStatus.PENDING)) {
      return this.handleSenderCancelBeforePayment(request);
    }

    // Case 2: Sender cancels after payment
    if (cancellationType === CancellationType.SENDER_CANCEL && paymentStatus === PaymentStatus.SUCCEEDED) {
      return this.handleSenderCancelAfterPayment(request, deliveryFee);
    }

    // Case 3: Traveler cancels
    if (cancellationType === CancellationType.TRAVELER_CANCEL) {
      return this.handleTravelerCancel(request, deliveryFee);
    }

    // Case 4: Mutual cancellation
    if (cancellationType === CancellationType.MUTUAL_CANCEL) {
      return this.handleMutualCancellation(request, deliveryFee);
    }

    // Case 5: System/Error cases
    return this.handleSystemCancellation(request, deliveryFee, cancellationType);
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
  private async handleSenderCancelAfterPayment(request: any, deliveryFee: number) {
    this.logger.log(`Sender cancelled after payment for request ${request.id}`);

    // Calculate cancellation fee: configurable percentage and minimum
    const cancellationFeePercent = Number(this.configService.get<number>('CANCELLATION_FEE_PERCENT'));
    const cancellationFeeMin = Number(this.configService.get<number>('CANCELLATION_FEE_MIN'));
    
    let cancellationFee = (deliveryFee * cancellationFeePercent) / 100;
    cancellationFee = Math.max(cancellationFee, cancellationFeeMin);

    const refundAmount = deliveryFee - cancellationFee;

    // Determine currency used for this request
    const currency: string = (request.currency || request.trip?.currency || 'EUR').toUpperCase();

    // Split cancellation fee: configurable percentages
    const travelerCompensationPercent = Number(this.configService.get<number>('CANCELLATION_TRAVELER_PERCENT'));
    const velroFeePercent = Number(this.configService.get<number>('CANCELLATION_VELRO_PERCENT'));
    
    const travelerCompensation = (cancellationFee * travelerCompensationPercent) / 100;
    const velroFee = (cancellationFee * velroFeePercent) / 100;

    // Process cancellation/refund to sender
    if (request.payment_intent_id) {
      await this.processStripeCancellationOrRefund(request.payment_intent_id, refundAmount);
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
   * Traveler cancels - full refund to sender
   */
  private async handleTravelerCancel(request: any, deliveryFee: number) {
    this.logger.log(`Traveler cancelled for request ${request.id}`);

    // Full cancellation/refund to sender
    if (request.payment_intent_id) {
      await this.processStripeCancellationOrRefund(request.payment_intent_id, deliveryFee);
    }

    const currency: string = (request.currency || request.trip?.currency || 'EUR').toUpperCase();

    return {
      requestId: request.id,
      cancellationType: CancellationType.TRAVELER_CANCEL,
      refundAmount: deliveryFee,
      cancellationFee: 0,
      travelerCompensation: 0,
      velroFee: 0,
      currency,
      status: 'CANCELLED',
      cancelledAt: new Date(),
    };
  }

  /**
   * Mutual cancellation - full refund
   */
  private async handleMutualCancellation(request: any, deliveryFee: number) {
    this.logger.log(`Mutual cancellation for request ${request.id}`);

    // Full cancellation/refund to sender
    if (request.payment_intent_id) {
      await this.processStripeCancellationOrRefund(request.payment_intent_id, deliveryFee);
    }

    const currency: string = (request.currency || request.trip?.currency || 'EUR').toUpperCase();

    return {
      requestId: request.id,
      cancellationType: CancellationType.MUTUAL_CANCEL,
      refundAmount: deliveryFee,
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
  private async handleSystemCancellation(request: any, deliveryFee: number, cancellationType: CancellationType) {
    this.logger.log(`System cancellation (${cancellationType}) for request ${request.id}`);

    // Full cancellation/refund to sender
    if (request.payment_intent_id) {
      await this.processStripeCancellationOrRefund(request.payment_intent_id, deliveryFee);
    }

    const currency: string = (request.currency || request.trip?.currency || 'EUR').toUpperCase();

    return {
      requestId: request.id,
      cancellationType,
      refundAmount: deliveryFee,
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

      // Get or create wallet
      const wallet = await this.walletService.ensureWallet(travelerId);

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
}
