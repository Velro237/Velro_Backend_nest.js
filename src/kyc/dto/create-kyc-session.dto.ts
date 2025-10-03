import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateKycsessionDto {
  @ApiProperty({
    description: 'Callback URL for verification completion',
    example: 'https://yourapp.com/kyc/callback',
    required: false,
  })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiProperty({
    description: 'Additional metadata to store with the session',
    example: '{"user_type": "premium", "account_id": "ABC123"}',
    required: false,
  })
  @IsOptional()
  @IsString()
  metadata?: string;
}
