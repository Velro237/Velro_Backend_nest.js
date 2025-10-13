import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, IsNotEmpty, Matches } from 'class-validator';

export class MobilemoneyDepositDto {
  @ApiProperty({
    description: 'Amount to deposit from mobile money account',
    example: 1000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Amount must be at least 100' })
  amount: number;

  @ApiProperty({
    description: 'Phone number to debit (Cameroonian mobile number)',
    example: '690264140',
    pattern: '^(69\\d{7}|67\\d{7}|68[0-4]\\d{6}|65\\d{7})$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(69\d{7}|67\d{7}|68[0-4]\d{6}|65\d{7})$/, {
    message:
      'Invalid phone number format. Must be a valid Cameroonian mobile number',
  })
  phoneNumber: string;
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
