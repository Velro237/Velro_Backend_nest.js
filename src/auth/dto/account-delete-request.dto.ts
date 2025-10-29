import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional } from 'class-validator';

export class CreateAccountDeleteRequestDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Reason for account deletion',
    example: 'I no longer need this account',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateAccountDeleteRequestResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Account deletion request submitted successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Account deletion request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;
}
