import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ConnectOnboardingDto {
  @ApiProperty({
    description: 'Country code for payout (ISO 3166-1 alpha-2)',
    example: 'FR',
    required: false,
  })
  @IsString()
  @IsOptional()
  country?: string;
}

export class ConnectOnboardingResponseDto {
  @ApiProperty({
    description: 'Stripe onboarding URL (open in webview or browser)',
    example: 'https://connect.stripe.com/setup/s/acct_xxx/abcd1234',
  })
  onboardingUrl: string;

  @ApiProperty({
    description: 'Stripe account ID',
    example: 'acct_1234567890',
  })
  accountId: string;

  @ApiProperty({
    description: 'Whether this is a new account or existing',
    example: true,
  })
  isNewAccount: boolean;
}

export class ConnectStatusResponseDto {
  @ApiProperty({
    description: 'Whether Stripe onboarding is complete',
    example: true,
  })
  isComplete: boolean;

  @ApiProperty({
    description: 'Transfers capability status',
    example: 'active',
    enum: ['inactive', 'pending', 'active', 'restricted'],
  })
  transfersCapability: string;

  @ApiProperty({
    description: 'Whether user can receive withdrawals',
    example: true,
  })
  canWithdraw: boolean;

  @ApiProperty({
    description: 'Stripe account ID',
    example: 'acct_1234567890',
    required: false,
  })
  accountId?: string;
}

