import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, IsNotEmpty, Matches } from 'class-validator';

export class MobilemoneyCashoutDto {
  @ApiProperty({
    description: 'Amount to cash out in local currency',
    example: 1000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Amount must be at least 100' })
  amount: number;

  @ApiProperty({
    description: 'Phone number to cash out to (Cameroonian mobile number)',
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
