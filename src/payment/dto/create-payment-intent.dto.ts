import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Order/Request ID - Backend will calculate amount from order details',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  orderId: string;

  // Security: Amount, currency, and travelerId are calculated server-side from the order
  // This prevents clients from tampering with payment amounts
}

export class PaymentIntentResponseDto {
  @ApiProperty({
    description: 'Client secret for Stripe PaymentIntent',
    example: 'pi_1234567890_secret_abcdefghijklmnop',
  })
  clientSecret: string;

  @ApiProperty({
    description: 'PaymentIntent ID',
    example: 'pi_1234567890',
  })
  paymentIntentId: string;

  @ApiProperty({
    description: 'Amount in currency units',
    example: 50.00,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'EUR',
  })
  currency: string;
}

