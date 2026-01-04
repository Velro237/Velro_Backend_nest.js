import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum } from 'class-validator';

export enum RefundDestination {
  SENDER = 'sender',
  TRAVELLER = 'traveller',
}

export enum RefundPortion {
  FULL = 'full',
  PARTIAL = 'partial',
}

export class AdminRefundRequestDto {
  @ApiProperty({
    description: 'Request ID to refund',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  request_id: string;

  @ApiProperty({
    description: 'Destination of the refund - sender (request creator) or traveller (trip owner)',
    enum: RefundDestination,
    example: RefundDestination.SENDER,
  })
  @IsEnum(RefundDestination)
  destination: RefundDestination;

  @ApiProperty({
    description: 'Portion of the refund - full (100%) or partial (50%)',
    enum: RefundPortion,
    example: RefundPortion.FULL,
  })
  @IsEnum(RefundPortion)
  portion: RefundPortion;
}

export class AdminRefundResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Refund processed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Transaction ID of the refund',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  transaction_id: string;

  @ApiProperty({
    description: 'Amount refunded',
    example: 150.5,
  })
  amount_refunded: number;

  @ApiProperty({
    description: 'Currency of the refund',
    example: 'EUR',
  })
  currency: string;

  @ApiProperty({
    description: 'User ID who received the refund',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  destination_user_id: string;
}

