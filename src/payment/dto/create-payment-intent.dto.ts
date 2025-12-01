import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Order/Request ID - Backend will calculate amount from order details',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional({
    description:
      'Optional device token for push notification of the payer on successful payment',
    example: 'ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

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

  @ApiProperty({
    description: 'Ephemeral key secret for Stripe customer',
    example: 'ek_test_YWNjdF8xR3VQb1hKbE1pWExYaW5YQ3dITlB4WlJPeU5jU3pRbm9lSnp3d09TbUtxT3VfT3VBY01oVEZicHRKcHduMEhDWjZGMUZ2VURrdW4tV2F4SFlvbk5sYV93c25TUUhvbE5ZdE5yT3M=',
  })
  ephemeralKeySecret: string;

  @ApiProperty({
    description: 'Stripe customer ID',
    example: 'cus_1234567890',
  })
  customerId: string;
}

