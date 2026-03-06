import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  IsUUID,
  IsIn,
} from 'class-validator';
import { OrderType } from '../../dto/create-payment-intent.dto';

export class CreateBankTransferPaymentDto {
  @ApiProperty({
    description: 'Order/Request ID to pay via bank transfer',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional({
    description:
      'Type of order being paid for. Defaults to "trip" for backward compatibility.',
    example: 'trip',
    enum: ['trip', 'shopping_offer', 'shipping_offer'],
  })
  @IsOptional()
  @IsIn(['trip', 'shopping_offer', 'shipping_offer'])
  orderType?: OrderType;
}

export class FundingInstructionsResponseDto {
  @ApiProperty({
    description: 'Bank account details for funding',
    example: {
      account_number: 'DE89370400440532013000',
      routing_number: null,
      sort_code: null,
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
    },
  })
  bankAccount: {
    account_number?: string;
    routing_number?: string;
    sort_code?: string;
    iban?: string;
    bic?: string;
    account_holder_name?: string;
  };

  @ApiProperty({
    description: 'Currency of the funding instructions',
    example: 'EUR',
  })
  currency: string;

  @ApiProperty({
    description: 'Type of bank transfer',
    example: 'eu_bank_transfer',
  })
  type: string;

  @ApiProperty({
    description: 'Reference code for the transfer',
    example: 'VELRO-123456',
  })
  reference?: string;
}

export class BankTransferInitResponseDto {
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
    example: 100.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'EUR',
  })
  currency: string;

  @ApiProperty({
    description: 'Stripe customer ID',
    example: 'cus_1234567890',
  })
  customerId: string;

  @ApiProperty({
    description: 'Ephemeral key secret for Stripe customer',
    example:
      'ek_test_YWNjdF8xR3VQb1hKbE1pWExYaW5YQ3dITlB4WlJPeU5jU3pRbm9lSnp3d09TbUtxT3VfT3VBY01oVEZicHRKcHduMEhDWjZGMUZ2VURrdW4tV2F4SFlvbk5sYV93c25TUUhvbE5ZdE5yT3M=',
  })
  ephemeralKeySecret: string;

  @ApiProperty({
    description: 'Bank transfer funding instructions',
    type: () => FundingInstructionsResponseDto,
  })
  fundingInstructions: FundingInstructionsResponseDto;
}

export class GetFundingInstructionsDto {
  @ApiProperty({
    description: 'Stripe customer ID',
    example: 'cus_1234567890',
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: 'Currency code (EUR, GBP, USD, JPY, MXN, CAD)',
    example: 'EUR',
    enum: ['EUR', 'GBP', 'USD', 'JPY', 'MXN', 'CAD'],
  })
  @IsEnum(['EUR', 'GBP', 'USD', 'JPY', 'MXN', 'CAD'])
  currency: string;
}

export class ReconcilePaymentDto {
  @ApiProperty({
    description: 'PaymentIntent ID to reconcile',
    example: 'pi_1234567890',
  })
  @IsString()
  paymentIntentId: string;

  @ApiProperty({
    description:
      'Amount to reconcile (optional, defaults to full PaymentIntent amount)',
    example: 100.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}

export class CustomerBalanceResponseDto {
  @ApiProperty({
    description: 'Available balance by currency',
    example: {
      eur: 100.0,
      usd: 0,
      gbp: 0,
    },
  })
  available: Record<string, number>;

  @ApiProperty({
    description: 'Customer ID',
    example: 'cus_1234567890',
  })
  customerId: string;
}

export class CustomerBalanceTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'cbtxn_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'funding',
    enum: [
      'funding',
      'applied_to_payment',
      'unapplied_from_payment',
      'refunded_from_payment',
      'return_cancelled',
      'return_initiated',
    ],
  })
  type: string;

  @ApiProperty({
    description: 'Net amount (in cents)',
    example: 10000,
  })
  netAmount: number;

  @ApiProperty({
    description: 'Currency',
    example: 'eur',
  })
  currency: string;

  @ApiProperty({
    description: 'Transaction status',
    example: 'pending',
    enum: ['pending', 'succeeded', 'failed'],
  })
  status: string;

  @ApiProperty({
    description: 'Created timestamp',
    example: 1234567890,
  })
  created: number;
}
