import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, ValidateIf } from 'class-validator';

export class GetWalletRequestDto {
  @ApiProperty({
    description: 'Wallet ID (provide either walletId or userId, not both)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  @ValidateIf((o) => !o.userId)
  walletId?: string;

  @ApiProperty({
    description: 'User ID (provide either walletId or userId, not both)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  @ValidateIf((o) => !o.walletId)
  userId?: string;
}

export class GetWalletResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Wallet retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Complete wallet information with user details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      available_balance: 1500.5,
      hold_balance: 250.0,
      total_balance: 1750.5,
      state: 'ACTIVE',
      currency: 'XAF',
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-16T14:30:00.000Z',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'user@example.com',
        name: 'John Doe',
        picture: 'https://example.com/profile.jpg',
        role: 'USER',
      },
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
    user: {
      id: string;
      email: string;
      name?: string;
      picture?: string;
      role: string;
    };
  };
}
