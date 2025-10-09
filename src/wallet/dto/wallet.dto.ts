import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, IsOptional, Min } from 'class-validator';

export class WithdrawalRequestDto {
  @ApiProperty({
    description: 'Amount to withdraw (in currency units)',
    example: 100.00,
    minimum: 1.00,
  })
  @IsNumber()
  @Min(1.00)
  amount: number;
}

export class WithdrawalResponseDto {
  @ApiProperty({
    description: 'Withdrawal ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Amount requested',
    example: 100.00,
  })
  amountRequested: number;

  @ApiProperty({
    description: 'Withdrawal fee applied',
    example: 2.50,
  })
  feeApplied: number;

  @ApiProperty({
    description: 'Net amount transferred to your account',
    example: 97.50,
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
    example: 150.50,
  })
  availableBalance: number;

  @ApiProperty({
    description: 'Pending balance (awaiting delivery confirmation)',
    example: 50.00,
  })
  pendingBalance: number;

  @ApiProperty({
    description: 'Total withdrawn amount',
    example: 300.00,
  })
  withdrawnTotal: number;

  @ApiProperty({
    description: 'Currency',
    example: 'EUR',
  })
  currency: string;
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
    example: 50.00,
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
    example: 200.50,
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

