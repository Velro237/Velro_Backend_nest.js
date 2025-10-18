import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsUrl,
  IsBoolean,
  Length,
  IsUUID,
} from 'class-validator';
import { UserRole } from 'generated/prisma/client';

export class SignupDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'password123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.USER,
    default: UserRole.USER,
    required: false,
  })
  @IsEnum(UserRole, { message: 'Role must be either USER or ADMIN' })
  @IsOptional()
  role?: UserRole = UserRole.USER;

  @ApiProperty({
    description: 'User first name',
    example: 'John Doe',
    required: true,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    required: true,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+237690264140',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: 'User address',
    example: 'Yaoundé, Cameroon',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'User city',
    example: 'Yaoundé',
    required: false,
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'User state',
    example: 'Cameroon',
    required: false,
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({
    description: 'User zip code',
    example: '123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  zip?: string;

  @ApiProperty({
    description: 'User picture',
    example: 'https://example.com/avatar.png',
    required: false,
  })
  @IsString()
  @IsUrl()
  @IsOptional()
  picture?: string;

  @ApiProperty({
    description: 'User is freight forwarder',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isFreightForwarder?: boolean;

  @ApiProperty({
    description: 'User company name',
    example: 'Freight Forwarder',
    required: false,
  })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({
    description: 'User company address',
    example: '123 Main St',
    required: false,
  })
  @IsString()
  @IsOptional()
  companyAddress?: string;

  @ApiProperty({
    description: 'Preferred currency (ISO 4217 code)',
    example: 'EUR',
    enum: ['USD', 'EUR', 'GBP', 'XAF'],
    default: 'EUR',
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string = 'EUR';
}

export class SignupResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'User created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created user information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+237690264140',
      address: 'Yaoundé, Cameroon',
      city: 'Yaoundé',
      state: 'Cameroon',
      zip: '123456',
      role: 'USER',
      createdAt: '2024-01-15T10:30:00.000Z',
      picture: 'https://example.com/avatar.png',
      isFreightForwarder: true,
      companyName: 'Freight Forwarder',
      companyAddress: '123 Main St',
      currency: 'EUR',
    },
  })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    role: UserRole;
    createdAt: Date;
    picture: string;
    isFreightForwarder: boolean;
    companyName: string;
    companyAddress: string;
    currency: string;
    otpCode?: string;
  };
}

export class VerifyEmailDto {
  @IsOptional()
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Code Otp',
    example: '123456',
    minLength: 6,
  })
  @MinLength(6, { message: 'Otp must be at least 6 characters long' })
  @IsString()
  @Length(6, 6)
  code!: string;
}
