import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CompanyCityDto {
  @ApiProperty({
    description: 'City name',
    example: 'Yaoundé',
  })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'City address',
    example: '123 Main Street, Yaoundé',
  })
  @IsString()
  @MinLength(1)
  address: string;

  @ApiProperty({
    description: 'Contact person name',
    example: 'John Doe',
  })
  @IsString()
  @MinLength(1)
  contactName: string;

  @ApiProperty({
    description: 'Contact person phone',
    example: '+237690264140',
  })
  @IsString()
  @MinLength(1)
  contactPhone: string;
}

export class CompanyServiceDto {
  @ApiProperty({
    description: 'Service name',
    example: 'Air Freight',
  })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'Service description',
    example: 'International air freight services',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class PendingSignupDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({
    description: 'Username',
    example: 'johndoe',
  })
  @IsString()
  @MinLength(1)
  username: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+237690264140',
  })
  @IsString()
  @MinLength(1)
  phone: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User city',
    example: 'Yaoundé',
    required: false,
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'User country',
    example: 'Cameroon',
    required: false,
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({
    description: 'Whether user is a freight forwarder',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isFreightForwarder?: boolean = false;

  @ApiProperty({
    description: 'Company name (required if isFreightForwarder is true)',
    example: 'Freight Forwarder Ltd',
    required: false,
  })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({
    description: 'Company address (required if isFreightForwarder is true)',
    example: '123 Business Street, Yaoundé',
    required: false,
  })
  @IsString()
  @IsOptional()
  companyAddress?: string;

  @ApiProperty({
    description: 'Company cities (required if isFreightForwarder is true)',
    type: [CompanyCityDto],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyCityDto)
  @IsOptional()
  cities?: CompanyCityDto[];

  @ApiProperty({
    description: 'Company services (required if isFreightForwarder is true)',
    type: [CompanyServiceDto],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyServiceDto)
  @IsOptional()
  services?: CompanyServiceDto[];

  @ApiProperty({
    description: 'User preferred language',
    example: 'en',
    enum: ['en', 'fr'],
    required: false,
  })
  @IsString()
  @IsEnum(['en', 'fr'], {
    message: 'Language must be either "en" or "fr"',
  })
  @IsOptional()
  lang?: 'en' | 'fr';
}

export class PendingSignupResponseDto {
  @ApiProperty({
    description: 'Success message',
    example:
      'Pending user created successfully. Please check your email for OTP.',
  })
  message: string;

  @ApiProperty({
    description: 'Pending user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  pendingUserId: string;

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
}

export class CheckOtpDto {
  @ApiProperty({
    description: 'Pending user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @MinLength(1)
  pendingUserId: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'OTP code must be exactly 6 digits' })
  code: string;
}

export class CheckOtpResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'OTP verified successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Access key to use for completing signup',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
  })
  accessKey: string;

  @ApiProperty({
    description: 'Pending user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  pendingUserId: string;
}

export class CompleteSignupDto {
  @ApiProperty({
    description: 'Pending user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @MinLength(1)
  pendingUserId: string;

  @ApiProperty({
    description: 'Access key from OTP verification',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
  })
  @IsString()
  @MinLength(1)
  accessKey: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'password123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

export class CompleteSignupResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'User account created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created user information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
      phone: '+237690264140',
      city: 'Yaoundé',
      isFreightForwarder: false,
      role: 'USER',
      createdAt: '2025-10-15T10:30:00.000Z',
    },
  })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    phone: string;
    city: string;
    isFreightForwarder: boolean;
    role: string;
    createdAt: Date;
  };
}

export class ResendOtpDto {
  @ApiProperty({
    description: 'Pending user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @MinLength(1)
  pendingUserId: string;
}

export class ResendOtpResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'OTP resent successfully',
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
}
