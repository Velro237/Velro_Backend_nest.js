import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { UserRole } from 'generated/prisma';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsOptional()
  @IsString()
  state: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiPropertyOptional({ example: '/example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  picture?: string;

  @ApiPropertyOptional({ minLength: 8, example: 'S3cur3P@ss' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isFreightForwarder?: boolean;

  @ApiPropertyOptional({ example: 'Freight Forwarder' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    example: 'device_123456789',
    description: 'Unique device identifier for push notifications',
  })
  @IsOptional()
  @IsString()
  device_id?: string;

  @ApiPropertyOptional({ example: 'johndoe' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    example: '1990-01-15',
    description: 'Date of birth in ISO 8601 format (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Preferred language code (e.g., en, fr)',
  })
  @IsOptional()
  @IsString()
  lang?: string;

  @ApiPropertyOptional({
    example: 'XAF',
    description: 'Preferred currency code (e.g., XAF, EUR, USD)',
  })
  @IsOptional()
  @IsString()
  currency?: string;
}
