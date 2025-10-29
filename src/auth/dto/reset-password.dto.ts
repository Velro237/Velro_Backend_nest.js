import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}

export class RequestPasswordResetResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Password reset link sent successfully',
  })
  message: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Access key received via email',
    example: 'abc123def456',
  })
  @IsString()
  @MinLength(1)
  accessKey: string;

  @ApiProperty({
    description: 'New password',
    example: 'newSecurePassword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class CheckPasswordResetOtpDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'OTP code received via email',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @MinLength(6)
  code: string;
}

export class CheckPasswordResetOtpResponseDto {
  @ApiProperty({
    description: 'Success message',
    example:
      'OTP verified successfully. Use the access key to reset your password.',
  })
  message: string;

  @ApiProperty({
    description: 'Access key to be used for password reset',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
  })
  accessKey: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Password reset successfully',
  })
  message: string;

  @ApiProperty({
    description: 'User information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      name: 'John Doe',
    },
  })
  user: {
    id: string;
    email: string;
    name: string;
  };
}
