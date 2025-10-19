import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CancellationType {
  SENDER_CANCEL = 'SENDER_CANCEL',
  TRAVELER_CANCEL = 'TRAVELER_CANCEL',
  MUTUAL_CANCEL = 'MUTUAL_CANCEL',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  FRAUD_DISPUTE = 'FRAUD_DISPUTE',
  TRAVELER_UNRESPONSIVE = 'TRAVELER_UNRESPONSIVE',
}

export class CancelRequestDto {
  @ApiProperty({
    description: 'Type of cancellation',
    enum: CancellationType,
    example: CancellationType.SENDER_CANCEL,
  })
  @IsEnum(CancellationType)
  cancellationType: CancellationType;

  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Change of plans',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CancelRequestResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request cancelled successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Cancellation details',
    example: {
      requestId: '123e4567-e89b-12d3-a456-426614174000',
      cancellationType: 'SENDER_CANCEL',
      refundAmount: 45.00,
      cancellationFee: 5.00,
      travelerCompensation: 3.50,
      velroFee: 1.50,
      status: 'CANCELLED',
    },
  })
  cancellation: {
    requestId: string;
    cancellationType: CancellationType;
    refundAmount?: number;
    cancellationFee?: number;
    travelerCompensation?: number;
    velroFee?: number;
    status: string;
    cancelledAt: Date;
  };
}
