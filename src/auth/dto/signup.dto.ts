import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { UserRole } from 'generated/prisma/client';

export class SignupDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'SecurePassword123!',
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
  };
}
