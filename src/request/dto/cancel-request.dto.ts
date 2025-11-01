import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CancellationType {
  SENDER_CANCEL = 'SENDER_CANCEL',
  TRAVELER_CANCEL = 'TRAVELER_CANCEL',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  FRAUD_DISPUTE = 'FRAUD_DISPUTE',
  TRAVELER_UNRESPONSIVE = 'TRAVELER_UNRESPONSIVE',
}

export enum PaymentStatusType {
  PAID = 'paid',
  UNPAID = 'unpaid',
}

export enum UnpaidCancellationReason {
  CHANGED_MY_MIND = 'Changed my mind',
  FOUND_BETTER_OPTION = 'Found a better option',
  PLANS_CHANGED = 'Plans changed',
  OTHER = 'Other',
}

export enum PaidCancellationReason {
  EMERGENCY_URGENT_SITUATION = 'Emergency/urgent situation',
  PLANS_CHANGED = 'Plans changed',
  FOUND_ANOTHER_OPTION = 'Found another option',
}

export class CancelRequestDto {
  @ApiProperty({
    description: 'Reason for cancellation. For unpaid requests: "Changed my mind", "Found a better option", "Plans changed", "Other". For paid requests: "Emergency/urgent situation", "Plans changed", "Found another option"',
    example: 'Plans changed',
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
