import { ApiProperty } from '@nestjs/swagger';

export class PaymentMethodRankingDto {
  @ApiProperty({
    description: 'Transaction provider (payment method)',
    example: 'MTN',
    enum: ['MTN', 'ORANGE', 'STRIPE'],
  })
  provider!: string;

  @ApiProperty({
    description:
      'Total count of transactions with status SEND, RECEIVED, COMPLETED, or SUCCESS',
    example: 1250,
  })
  count!: number;
}

export class AdminPaymentMethodRankingResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Payment method ranking retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description:
      'Array of payment methods with transaction counts, ordered by highest count',
    type: [PaymentMethodRankingDto],
  })
  paymentMethods!: PaymentMethodRankingDto[];
}
