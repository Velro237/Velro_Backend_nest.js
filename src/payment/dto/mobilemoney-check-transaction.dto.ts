import { ApiProperty } from '@nestjs/swagger';

export class MobilemoneyCheckTransactionResponseDto {
  @ApiProperty({
    description: 'Transaction status data from the provider',
    example: {
      partnerId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'RECEIVED',
      amount: '135000.0',
      // ... other transaction data
    },
  })
  data: any;

  @ApiProperty({
    description: 'Success message',
    example: 'Transaction status retrieved successfully',
  })
  message?: string;
}
