import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsString,
  IsOptional,
} from 'class-validator';

export class AdminMoveHoldBalanceDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  userId: string;

  @ApiProperty({
    description: 'Amount to move from hold balance to available balance',
    example: 100.5,
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Currency (optional, defaults to wallet currency)',
    example: 'EUR',
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string;
}

export class AdminMoveHoldBalanceResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Balance moved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Transaction details',
    type: Object,
    additionalProperties: true,
  })
  transaction: {
    id: string;
    type: string;
    source: string;
    amountRequested: number;
    amountPaid: number;
    currency: string;
    status: string;
    balanceAfter: number;
    createdAt: Date;
  };

  @ApiProperty({
    description: 'Updated wallet balances',
    type: Object,
    additionalProperties: true,
  })
  wallet: {
    availableBalance: number;
    holdBalance: number;
    currency: string;
  };
}
