import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum CancellationReason {
  FLIGHT_CANCELLED = 'FLIGHT_CANCELLED',
  PERSONAL_EMERGENCY = 'PERSONAL_EMERGENCY',
  CHANGE_OF_PLANS = 'CHANGE_OF_PLANS',
  OTHER = 'OTHER',
}

export class CancelTripDto {
  @ApiProperty({
    description: 'Reason for trip cancellation',
    enum: CancellationReason,
    example: CancellationReason.CHANGE_OF_PLANS,
  })
  @IsEnum(CancellationReason)
  @IsNotEmpty()
  reason: CancellationReason;

  @ApiProperty({
    description: 'Additional details about the cancellation (optional)',
    example: 'I need to reschedule due to a family emergency',
    required: false,
  })
  @IsString()
  @IsOptional()
  additionalNotes?: string;
}

export class CancelTripResponseDto {
  @ApiProperty({
    description: 'Success message',
    example:
      'Trip cancelled successfully. Refunds processed for affected requests.',
  })
  message: string;

  @ApiProperty({
    description: 'Trip ID that was cancelled',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tripId: string;

  @ApiProperty({
    description: 'Number of requests affected by cancellation',
    example: 3,
  })
  affectedRequests: number;

  @ApiProperty({
    description: 'Number of refunds processed',
    example: 2,
  })
  refundsProcessed: number;
}
