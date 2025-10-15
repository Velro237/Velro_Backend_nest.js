import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OtpType {
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
}

export class SendOtpDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Type of OTP',
    enum: OtpType,
    example: OtpType.VERIFY_EMAIL,
  })
  @IsEnum(OtpType)
  @IsNotEmpty()
  type: OtpType;

  @ApiProperty({
    description: 'Optional phone number',
    example: '+1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  code: string;

  @ApiProperty({
    description: 'Type of OTP',
    enum: OtpType,
    example: OtpType.VERIFY_EMAIL,
  })
  @IsEnum(OtpType)
  @IsNotEmpty()
  type: OtpType;
}

export class SendOtpResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'OTP sent successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Email where OTP was sent',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'OTP expiration timestamp',
    example: '2025-10-15T14:30:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'OTP code (only in development)',
    example: '123456',
    required: false,
  })
  code?: string;
}

export class VerifyOtpResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'OTP verified successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Whether the OTP was verified',
    example: true,
  })
  verified: boolean;

  @ApiProperty({
    description: 'Access key to use for subsequent operations',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
  })
  accessKey: string;

  @ApiProperty({
    description: 'Email associated with the OTP',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Type of OTP',
    enum: OtpType,
    example: OtpType.VERIFY_EMAIL,
  })
  type: string;
}

export class VerifyAccessKeyDto {
  @ApiProperty({
    description: 'Access key to verify',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
  })
  @IsString()
  @IsNotEmpty()
  accessKey: string;

  @ApiProperty({
    description: 'Email address associated with the access key',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Optional: Type of OTP to verify against',
    enum: OtpType,
    example: OtpType.VERIFY_EMAIL,
    required: false,
  })
  @IsEnum(OtpType)
  @IsOptional()
  type?: OtpType;
}

export class VerifyAccessKeyResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Access key is valid',
  })
  message: string;

  @ApiProperty({
    description: 'Whether the access key is valid',
    example: true,
  })
  valid: boolean;

  @ApiProperty({
    description: 'Email associated with the access key',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Type of OTP',
    example: 'VERIFY_EMAIL',
  })
  type: string;
}
