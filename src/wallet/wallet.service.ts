import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../payment/stripe.service';
import { 
  WithdrawalRequestDto, 
  WithdrawalResponseDto, 
  WalletResponseDto,
  WalletBalanceDto,
  WalletTransactionDto,
} from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  /**
   * Get wallet information with transactions
   */
  async getWallet(userId: string): Promise<WalletResponseDto> {
    try {
      this.logger.log(`Getting wallet for user ${userId}`);

      // Ensure wallet exists
      const wallet = await this.ensureWallet(userId);

      // Get recent transactions (last 50) - includes both transactions and withdrawals
      const transactions = await this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // Filter withdrawals from transactions
      const withdrawals = transactions.filter(t => t.source === 'WITHDRAW');

      return {
        balance: {
          availableBalance: Number(wallet.available_balance_stripe),
          pendingBalance: Number(wallet.pending_balance_stripe),
          withdrawnTotal: Number(wallet.withdrawn_total_stripe),
          currency: wallet.currency,
        },
        transactions: transactions.map(t => this.mapTransaction(t)),
        withdrawals: withdrawals.map(w => this.mapWithdrawal(w)),
      };
    } catch (error) {
      this.logger.error('Failed to get wallet:', error);
      throw error;
    }
  }

  /**
   * Request withdrawal
   */
  async requestWithdrawal(
    userId: string,
    dto: WithdrawalRequestDto,
  ): Promise<WithdrawalResponseDto> {
    try {
      this.logger.log(`Processing withdrawal request for user ${userId}: ${dto.amount}`);

      // Get user and check Stripe account
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.stripe_account_id) {
        throw new BadRequestException('Please complete payout setup first');
      }

      if (user.transfers_capability !== 'active') {
        throw new BadRequestException('Your payout account is not yet active. Please complete verification.');
      }

      // Get wallet
      const wallet = user.wallet;
      if (!wallet) {
        throw new BadRequestException('Wallet not found');
      }

      const availableBalance = Number(wallet.available_balance_stripe);

      // Check if sufficient balance
      if (availableBalance < dto.amount) {
        throw new BadRequestException(
          `Insufficient balance. Available: ${availableBalance} ${wallet.currency}`
        );
      }

      // Calculate withdrawal fee
      const fee = this.calculateWithdrawalFee(dto.amount);
      const netAmount = dto.amount - fee;

      // Minimum withdrawal check
      const minWithdrawal = this.configService.get<number>('MIN_WITHDRAWAL_AMOUNT', 10.0);
      if (netAmount < minWithdrawal) {
        throw new BadRequestException(`Minimum withdrawal amount is ${minWithdrawal} ${wallet.currency}`);
      }

      // Create withdrawal transaction record
      const withdrawal = await this.prisma.transaction.create({
        data: {
          userId,
          wallet_id: wallet.id,
          type: 'DEBIT',
          source: 'WITHDRAW',
          amount_requested: dto.amount,
          fee_applied: fee,
          amount_paid: netAmount,
          currency: wallet.currency,
          stripe_account_id: user.stripe_account_id,
          status: 'PENDING',
          provider: 'STRIPE',
          description: `Withdrawal request`,
          balance_after: availableBalance - dto.amount,
          metadata: {
            feeApplied: fee,
            netAmount,
          },
        },
      });

      // Deduct from available balance
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          available_balance_stripe: {
            decrement: dto.amount,
          },
        },
      });

      // Create Stripe Transfer
      try {
        const transfer = await this.stripeService.createTransfer({
          amount: netAmount,
          currency: wallet.currency,
          destination: user.stripe_account_id,
          transferGroup: withdrawal.id,
          metadata: {
            userId,
            withdrawalId: withdrawal.id,
          },
        });

        // Update withdrawal transaction with transfer ID
        await this.prisma.transaction.update({
          where: { id: withdrawal.id },
          data: {
            stripe_transfer_id: transfer.id,
            status: 'SUCCESS',
          },
        });

        this.logger.log(`Withdrawal created successfully: ${withdrawal.id}, Transfer: ${transfer.id}`);

        return this.mapWithdrawal({
          ...withdrawal,
          stripe_transfer_id: transfer.id,
          status: 'SUCCESS',
        });
      } catch (transferError) {
        // Rollback: restore balance
        await this.prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            available_balance_stripe: {
              increment: dto.amount,
            },
          },
        });

        // Mark withdrawal as failed
        await this.prisma.transaction.update({
          where: { id: withdrawal.id },
          data: {
            status: 'FAILED',
            status_message: transferError.message,
          },
        });

        throw new BadRequestException(`Withdrawal failed: ${transferError.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to process withdrawal:', error);
      throw error;
    }
  }

  /**
   * Move earnings from pending to available after delivery confirmation
   */
  async moveToAvailable(orderId: string): Promise<void> {
    try {
      this.logger.log(`Moving earnings to available for order ${orderId}`);

      const order = await this.prisma.tripRequest.findUnique({
        where: { id: orderId },
        include: {
          trip: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const travelerId = order.trip.user_id;
      const wallet = await this.ensureWallet(travelerId);

      // Find the pending transaction for this order
      const pendingTransaction = await this.prisma.transaction.findFirst({
        where: {
          userId: travelerId,
          request_id: orderId,
          source: 'TRIP_EARNING',
          type: 'CREDIT',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!pendingTransaction) {
        this.logger.warn(`No pending transaction found for order ${orderId}`);
        return;
      }

      const amount = Number(pendingTransaction.amount_paid);

      // Apply hold policy if configured
      const holdHours = this.configService.get<number>('HOLD_POLICY_HOURS', 0);
      if (holdHours > 0 && order.delivered_at) {
        const releaseTime = new Date(order.delivered_at.getTime() + holdHours * 60 * 60 * 1000);
        if (new Date() < releaseTime) {
          this.logger.log(`Order ${orderId} is in hold period until ${releaseTime}`);
          // Schedule this to run later or use a cron job
          return;
        }
      }

      // Move from pending to available
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          pending_balance_stripe: {
            decrement: amount,
          },
          available_balance_stripe: {
            increment: amount,
          },
        },
      });

      // Create transaction for the move
      await this.prisma.transaction.create({
        data: {
          userId: travelerId,
          wallet_id: wallet.id,
          type: 'CREDIT',
          source: 'TRIP_EARNING',
          amount_requested: amount,
          fee_applied: 0,
          amount_paid: amount,
          currency: wallet.currency,
          request_id: orderId,
          status: 'COMPLETED',
          provider: 'STRIPE',
          description: `Earnings released for order ${orderId}`,
          balance_after: Number(wallet.available_balance_stripe) + amount,
          metadata: {
            orderId,
            movedFromPending: true,
          },
        },
      });

      this.logger.log(`Moved ${amount} to available balance for user ${travelerId}`);
    } catch (error) {
      this.logger.error('Failed to move to available:', error);
      throw error;
    }
  }

  /**
   * Handle transfer completed webhook
   */
  async handleTransferCompleted(transferId: string): Promise<void> {
    try {
      this.logger.log(`Handling transfer completed: ${transferId}`);

      const withdrawal = await this.prisma.transaction.findUnique({
        where: { stripe_transfer_id: transferId },
      });

      if (!withdrawal) {
        this.logger.warn(`Withdrawal not found for transfer: ${transferId}`);
        return;
      }

      await this.prisma.transaction.update({
        where: { id: withdrawal.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      // Update withdrawn total
      await this.prisma.wallet.update({
        where: { userId: withdrawal.userId },
        data: {
          withdrawn_total_stripe: {
            increment: withdrawal.amount_paid,
          },
        },
      });

      this.logger.log(`Withdrawal ${withdrawal.id} marked as completed`);
    } catch (error) {
      this.logger.error('Failed to handle transfer completed:', error);
      throw error;
    }
  }

  /**
   * Handle transfer failed webhook
   */
  async handleTransferFailed(transferId: string, reason: string): Promise<void> {
    try {
      this.logger.log(`Handling transfer failed: ${transferId}`);

      const withdrawal = await this.prisma.transaction.findUnique({
        where: { stripe_transfer_id: transferId },
      });

      if (!withdrawal) {
        this.logger.warn(`Withdrawal not found for transfer: ${transferId}`);
        return;
      }

      // Mark as failed
      await this.prisma.transaction.update({
        where: { id: withdrawal.id },
        data: {
          status: 'FAILED',
          status_message: reason,
        },
      });

      // Restore balance
      await this.prisma.wallet.update({
        where: { userId: withdrawal.userId },
        data: {
          available_balance_stripe: {
            increment: withdrawal.amount_requested,
          },
        },
      });

      this.logger.log(`Withdrawal ${withdrawal.id} marked as failed, balance restored`);
    } catch (error) {
      this.logger.error('Failed to handle transfer failed:', error);
      throw error;
    }
  }

  /**
   * Calculate withdrawal fee
   */
  private calculateWithdrawalFee(amount: number): number {
    // Client spec: 2% (minimum €1.00, no fixed fee)
    const feePercent = Number(this.configService.get<number>('WITHDRAWAL_FEE_PERCENT'));
    const feeMin = Number(this.configService.get<number>('WITHDRAWAL_FEE_MIN'));

    let fee = (amount * feePercent / 100);
    fee = Math.max(fee, feeMin);

    return Math.round(fee * 100) / 100; // Round to 2 decimals
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
          currency: 'EUR',
        },
      });
    }

    return wallet;
  }

  /**
   * Map transaction to DTO
   */
  private mapTransaction(transaction: any): WalletTransactionDto {
    return {
      id: transaction.id,
      type: transaction.type,
      source: transaction.source,
      amount: Number(transaction.amount_paid),
      currency: transaction.currency,
      description: transaction.description,
      balanceAfter: Number(transaction.balance_after),
      createdAt: transaction.createdAt,
    };
  }

  /**
   * Map withdrawal to DTO
   */
  private mapWithdrawal(withdrawal: any): WithdrawalResponseDto {
    return {
      id: withdrawal.id,
      amountRequested: Number(withdrawal.amount_requested),
      feeApplied: Number(withdrawal.fee_applied),
      amountNet: Number(withdrawal.amount_paid),
      currency: withdrawal.currency,
      status: withdrawal.status,
      stripeTransferId: withdrawal.stripe_transfer_id,
      createdAt: withdrawal.createdAt,
    };
  }
}

