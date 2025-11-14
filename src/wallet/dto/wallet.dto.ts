import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsUUID,
  IsOptional,
  Min,
  IsEnum,
  IsString,
  IsInt,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WalletState } from 'generated/prisma/client';

export class WithdrawalRequestDto {
  @ApiProperty({
    description: 'Amount to withdraw (in currency units)',
    example: 100.0,
    minimum: 1.0,
  })
  @IsNumber()
  @Min(1.0)
  amount: number;

  @ApiProperty({
    description: 'Currency to withdraw in',
    example: 'USD',
    default: 'EUR',
  })
  @IsString()
  @IsOptional()
  currency?: string;
}

export class WithdrawalResponseDto {
  @ApiProperty({
    description: 'Withdrawal ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Amount requested',
    example: 100.0,
  })
  amountRequested: number;

  @ApiProperty({
    description: 'Withdrawal fee applied',
    example: 2.5,
  })
  feeApplied: number;

  @ApiProperty({
    description: 'Net amount transferred to your account',
    example: 97.5,
  })
  amountNet: number;

  @ApiProperty({
    description: 'Currency',
    example: 'EUR',
  })
  currency: string;

  @ApiProperty({
    description: 'Withdrawal status',
    example: 'PENDING',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  })
  status: string;

  @ApiProperty({
    description: 'Stripe transfer ID',
    example: 'tr_1234567890',
    required: false,
  })
  stripeTransferId?: string;

  @ApiProperty({
    description: 'Created at timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;
}

export class WalletBalanceDto {
  // Generic balances (wallet currency)
  @ApiProperty({
    description: 'Available balance (wallet currency)',
    example: 0,
  })
  availableBalance: number;

  @ApiProperty({
    description: 'Hold balance (wallet currency)',
    example: 0,
  })
  holdBalance: number;

  @ApiProperty({
    description: 'Total balance (wallet currency)',
    example: 0,
  })
  totalBalance: number;

  @ApiProperty({
    description: 'Currency of the user (wallet currency)',
    example: 'EUR',
  })
  currency: string;

  // XAF balances
  @ApiProperty({
    description: 'Available balance in XAF',
    example: 0,
  })
  availableBalanceXaf: number;

  @ApiProperty({
    description: 'Hold balance in XAF',
    example: 0,
  })
  holdBalanceXaf: number;

  // USD balances
  @ApiProperty({
    description: 'Available balance in USD',
    example: 0,
  })
  availableBalanceUsd: number;

  @ApiProperty({
    description: 'Hold balance in USD',
    example: 0,
  })
  holdBalanceUsd: number;

  // EUR balances
  @ApiProperty({
    description: 'Available balance in EUR',
    example: 0,
  })
  availableBalanceEur: number;

  @ApiProperty({
    description: 'Hold balance in EUR',
    example: 0,
  })
  holdBalanceEur: number;

  // CAD balances
  @ApiProperty({
    description: 'Available balance in CAD',
    example: 0,
  })
  availableBalanceCad: number;

  @ApiProperty({
    description: 'Hold balance in CAD',
    example: 0,
  })
  holdBalanceCad: number;
}

export class WalletTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'CREDIT',
    enum: ['CREDIT', 'DEBIT'],
  })
  type: string;

  @ApiProperty({
    description: 'Transaction source',
    example: 'ORDER',
    enum: ['ORDER', 'WITHDRAWAL', 'ADJUSTMENT', 'REFUND', 'COMMISSION'],
  })
  source: string;

  @ApiProperty({
    description: 'Amount',
    example: 50.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency',
    example: 'EUR',
  })
  currency: string;

  @ApiProperty({
    description: 'Description',
    example: 'Earnings from order #123',
  })
  description?: string;

  @ApiProperty({
    description: 'Balance after transaction',
    example: 200.5,
  })
  balanceAfter: number;

  @ApiProperty({
    description: 'Created at timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;
}

export class WalletResponseDto {
  @ApiProperty({
    description: 'Wallet balance information',
    type: WalletBalanceDto,
  })
  balance: WalletBalanceDto;

  @ApiProperty({
    description: 'Recent withdrawals',
    type: [WithdrawalResponseDto],
  })
  withdrawals: WithdrawalResponseDto[];
}

export class ChangeWalletStateDto {
  @ApiProperty({
    description: 'Wallet state to set',
    enum: WalletState,
    example: WalletState.ACTIVE,
  })
  @IsEnum(WalletState)
  state: WalletState;

  @ApiProperty({
    description: 'Optional message explaining the state change',
    example: 'Wallet activated after verification',
    required: false,
  })
  @IsString()
  @IsOptional()
  status_message?: string;
}

export class ChangeWalletStateResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Wallet state updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated wallet information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174000',
      state: 'ACTIVE',
      status_message: 'Wallet activated after verification',
      updatedAt: '2024-01-15T10:30:00.000Z',
    },
  })
  wallet: {
    id: string;
    userId: string;
    state: WalletState;
    status_message: string | null;
    updatedAt: Date;
  };
}

// Detailed transaction with trip information
export class DetailedTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'CREDIT',
    enum: ['CREDIT', 'DEBIT'],
  })
  type: string;

  @ApiProperty({
    description: 'Transaction source',
    example: 'TRIP_EARNING',
  })
  source: string;

  @ApiProperty({
    description: 'Transaction status',
    example: 'SUCCESS',
  })
  status: string;

  @ApiProperty({
    description: 'Amount requested',
    example: 50.0,
  })
  amountRequested: number;

  @ApiProperty({
    description: 'Fee applied',
    example: 2.5,
  })
  feeApplied: number;

  @ApiProperty({
    description: 'Amount paid',
    example: 47.5,
  })
  amountPaid: number;

  @ApiProperty({
    description: 'Currency',
    example: 'EUR',
  })
  currency: string;

  @ApiProperty({
    description: 'Payment provider',
    example: 'STRIPE',
  })
  provider: string;

  @ApiProperty({
    description: 'Created at timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Processed at timestamp',
    example: '2024-01-15T10:35:00.000Z',
    required: false,
  })
  processedAt?: Date;

  @ApiProperty({
    description: 'Trip departure information',
    example: { city: 'Paris', country: 'France' },
    required: false,
  })
  tripDeparture?: any;

  @ApiProperty({
    description: 'Trip destination information',
    example: { city: 'London', country: 'UK' },
    required: false,
  })
  tripDestination?: any;

  @ApiProperty({
    description: 'Trip creator (traveler) information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      picture: 'https://example.com/image.jpg',
    },
    required: false,
  })
  tripCreator?: {
    id: string;
    name: string;
    picture?: string;
  };

  @ApiProperty({
    description: 'Request user (sender) information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Jane Smith',
      picture: 'https://example.com/image.jpg',
    },
    required: false,
  })
  requestUser?: {
    id: string;
    name: string;
    picture?: string;
  };

  @ApiProperty({
    description:
      'Total kg booked in the request (sum of trip items quantities)',
    example: 5.5,
    required: false,
  })
  bookedKg?: number;

  @ApiProperty({
    description: 'Trip status',
    example: 'COMPLETED',
    enum: [
      'PUBLISHED',
      'SCHEDULED',
      'RESCHEDULED',
      'INPROGRESS',
      'CANCELLED',
      'COMPLETED',
      'DRAFT',
    ],
    required: false,
  })
  tripStatus?: string;
}

// Transactions grouped by date
export class GroupedTransactionsDto {
  @ApiProperty({
    description: 'Date of transactions (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  date: string;

  @ApiProperty({
    description: 'Transactions for this date',
    type: [DetailedTransactionDto],
  })
  transactions: DetailedTransactionDto[];
}

// Pagination query parameters
export class PaginationQueryDto {
  @ApiProperty({
    description: 'Page number (starts at 1)',
    example: 1,
    default: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// Response for wallet transactions endpoint
export class WalletTransactionsResponseDto {
  @ApiProperty({
    description: 'Transactions grouped by date',
    type: [GroupedTransactionsDto],
  })
  groupedTransactions: GroupedTransactionsDto[];

  @ApiProperty({
    description: 'Total number of transactions',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 2,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNextPage: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPreviousPage: boolean;

  @ApiProperty({
    description:
      'Total earnings from all CREDIT transactions (sum of amount_paid)',
    example: 1500.5,
  })
  totalEarnings: number;

  @ApiProperty({
    description:
      'Total withdrawn from all WITHDRAW transactions (sum of amount_paid)',
    example: 500.0,
  })
  totalWithdrawn: number;
}
