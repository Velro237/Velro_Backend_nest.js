import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { OrderType } from './create-payment-intent.dto';

export class MobilemoneyCashoutDto {
  @ApiPropertyOptional({
    description:
      'Type of order being paid for. Defaults to "trip" for backward compatibility.',
    example: 'trip',
    enum: ['trip', 'shopping_offer', 'shipping_offer'],
  })
  @IsOptional()
  @IsIn(['trip', 'shopping_offer', 'shipping_offer'])
  orderType?: OrderType;

  @ApiPropertyOptional({
    description:
      'Trip request ID. Required when orderType is "trip" or omitted.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ValidateIf(
    (o) => !o.orderType || o.orderType === 'trip',
  )
  @IsUUID()
  @IsNotEmpty()
  requestId?: string;

  @ApiPropertyOptional({
    description:
      'Offer ID. Required when orderType is "shopping_offer" or "shipping_offer".',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ValidateIf(
    (o) => o.orderType === 'shopping_offer' || o.orderType === 'shipping_offer',
  )
  @IsUUID()
  @IsNotEmpty()
  orderId?: string;

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
