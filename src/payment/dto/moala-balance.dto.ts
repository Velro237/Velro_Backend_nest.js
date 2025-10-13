import { ApiProperty } from '@nestjs/swagger';

export class MoalaBalanceResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Balance retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Moala account balance details',
    example: {
      balance: 150000.0,
      currency: 'XAF',
      availableBalance: 150000.0,
      pendingBalance: 0.0,
    },
  })
  balance: any;
}
