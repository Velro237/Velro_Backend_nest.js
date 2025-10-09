import { ApiProperty } from '@nestjs/swagger';

export class InitializeWalletResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Wallet initialized successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created wallet information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      available_balance: 0.0,
      hold_balance: 0.0,
      total_balance: 0.0,
      state: 'BLOCKED',
      currency: 'XAF',
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z',
    },
  })
  wallet: {
    id: string;
    userId: string;
    available_balance: number;
    hold_balance: number;
    total_balance: number;
    state: string;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
  };
}
