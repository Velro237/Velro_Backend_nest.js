import { ApiProperty } from '@nestjs/swagger';
import {
  WalletResponseDto,
  DetailedTransactionDto,
} from '../../wallet/dto/wallet.dto';

export class AdminUserWalletTransactionsResponseDto {
  @ApiProperty({
    description: 'List of transactions (not grouped by date)',
    type: [DetailedTransactionDto],
  })
  transactions!: DetailedTransactionDto[];

  @ApiProperty({
    description: 'Total number of transactions',
    example: 25,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 2,
  })
  totalPages!: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNextPage!: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPreviousPage!: boolean;

  @ApiProperty({
    description:
      'Total earnings from all CREDIT transactions (sum of amount_paid)',
    example: 1500.5,
  })
  totalEarnings!: number;

  @ApiProperty({
    description:
      'Total withdrawn from all WITHDRAW transactions (sum of amount_paid)',
    example: 500.0,
  })
  totalWithdrawn!: number;
}

export class AdminUserWalletResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'User wallet information retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Wallet information',
    type: WalletResponseDto,
  })
  wallet!: WalletResponseDto;

  @ApiProperty({
    description: 'Wallet transactions with pagination (not grouped by date)',
    type: AdminUserWalletTransactionsResponseDto,
  })
  transactions!: AdminUserWalletTransactionsResponseDto;
}
