import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsUUID,
  IsOptional,
  Min,
  IsEnum,
  IsString,
} from 'class-validator';
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
  @ApiProperty({
    description: 'Available balance (withdrawable now)',
    example: 150.5,
  })
  availableBalance: number;

  @ApiProperty({
    description: 'Pending balance (awaiting delivery confirmation)',
    example: 50.0,
  })
  pendingBalance: number;

  @ApiProperty({
    description: 'Total withdrawn amount',
    example: 300.0,
  })
  withdrawnTotal: number;

  @ApiProperty({
    description: 'Currency',
    example: 'EUR',
  })
  currency: string;

  @ApiProperty({
    description: 'Multi-currency balances (earnings in original currencies)',
    example: [
      { currency: 'EUR', amount: 100.0 },
      { currency: 'USD', amount: 50.0 },
      { currency: 'CAD', amount: 25.0 }
    ],
    required: false,
  })
  multiCurrencyBalances?: Array<{
    currency: string;
    amount: number;
  }>;
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
    description: 'Recent transactions',
    type: [WalletTransactionDto],
  })
  transactions: WalletTransactionDto[];

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
