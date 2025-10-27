import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, IsNotEmpty, IsUUID } from 'class-validator';

export class MobilemoneyDepositDto {
  @ApiProperty({
    description: 'Amount to deposit to mobile money account',
    example: 1000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Amount must be at least 100' })
  amount: number;

  @ApiProperty({
    description: 'Withdrawal number ID to send money to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID('4', { message: 'Invalid withdrawal number ID format' })
  withdrawalNumberId: string;
}

export class MobilemoneyDepositResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Deposit initiated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Deposit transaction details',
    example: {
      transactionId: 'txn-123456',
      amount: 1000,
      phoneNumber: '690264140',
      carrier: 'ORANGE_CM',
      status: 'PENDING',
    },
  })
  transaction: {
    transactionId: string;
    amount: number;
    phoneNumber: string;
    carrier: string;
    status: string;
  };
}
