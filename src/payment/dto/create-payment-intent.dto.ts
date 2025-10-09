import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsUUID, Min, IsOptional, IsEnum } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Order/Request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: 'Amount in currency units (e.g., 50.00 for €50.00)',
    example: 50.00,
    minimum: 0.50,
  })
  @IsNumber()
  @Min(0.50)
  amount: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'EUR',
    default: 'EUR',
  })
  @IsString()
  @IsOptional()
  currency?: string = 'EUR';

  @ApiProperty({
    description: 'Traveler user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  travelerId: string;
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

