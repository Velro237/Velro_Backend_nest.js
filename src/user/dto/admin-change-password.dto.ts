import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminChangePasswordDto {
  @ApiProperty({
    description: 'Email of the user whose password should be changed',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'New password for the user',
    example: 'newSecurePassword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class AdminChangePasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Password changed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'User ID whose password was changed',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;
}
