import { ApiProperty } from '@nestjs/swagger';

export class RequestStatusCountDto {
  @ApiProperty({
    description: 'Request status',
    example: 'DELIVERED',
    enum: [
      'PENDING',
      'ACCEPTED',
      'DECLINED',
      'CANCELLED',
      'REFUNDED',
      'EXPIRED',
      'CONFIRMED',
      'SENT',
      'RECEIVED',
      'IN_TRANSIT',
      'PENDING_DELIVERY',
      'DELIVERED',
      'REVIEWED',
    ],
  })
  status!: string;

  @ApiProperty({
    description: 'Number of requests with this status',
    example: 1250,
  })
  count!: number;
}

export class AdminRequestStatusDistributionResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request status distribution retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Array of request statuses with their counts',
    type: [RequestStatusCountDto],
  })
  statusDistribution!: RequestStatusCountDto[];
}

