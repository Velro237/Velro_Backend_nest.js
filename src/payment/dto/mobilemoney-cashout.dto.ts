import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsUUID } from 'class-validator';

export class MobilemoneyCashoutDto {
  @ApiProperty({
    description: 'Trip request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  requestId: string;

  @ApiProperty({
    description: 'Withdrawal number ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  withdrawalNumberId: string;
}

export class MobilemoneyCashoutResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Withdrawal initiated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Withdrawal transaction details',
    example: {
      transactionId: 'txn-123456',
      amount: 1000,
      phoneNumber: '690264140',
      carrier: 'ORANGE_CM',
      status: 'PENDING',
    },
    required: false,
  })
  transaction?: {
    transactionId?: string;
    amount: number;
    phoneNumber: string;
    carrier: string;
    status: string;
  };
}
