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
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from 'generated/prisma';

export class CompanyServiceDto {
  @ApiPropertyOptional({
    description:
      'Service ID (optional - if provided, will connect to existing service)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Logistics',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Service description',
    example: 'Full logistics services including warehousing and delivery',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CompanyCityDto {
  @ApiPropertyOptional({
    description: 'City ID (optional - if provided, will update existing city)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({
    description: 'City/Office name',
    example: 'Paris Office',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Office address',
    example: '123 Main St, Paris',
  })
  @IsString()
  address: string;

  @ApiProperty({
    description: 'Contact person name',
    example: 'John Doe',
  })
  @IsString()
  contactName: string;

  @ApiProperty({
    description: 'Contact phone number',
    example: '+1234567890',
  })
  @IsString()
  contactPhone: string;
}

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

  @ApiPropertyOptional({
    example: 'Logistics',
    description: 'Type of business',
  })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({
    example: 'Additional company information',
    description: 'Additional information about the company or user',
  })
  @IsOptional()
  @IsString()
  additionalInfo?: string;

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

  @ApiProperty({ example: 'johndoe' })
  @IsString()
  @MinLength(1)
  username: string;

  @ApiPropertyOptional({
    example: '1990-01-15',
    description: 'Date of birth in ISO 8601 format (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Preferred language code',
    enum: ['en', 'fr'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['en', 'fr'], {
    message: 'Language must be either "en" or "fr"',
  })
  lang?: 'en' | 'fr';

  @ApiPropertyOptional({
    example: 'XAF',
    description: 'Preferred currency code (e.g., XAF, EUR, USD)',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Array of company service objects to create/update',
    type: [CompanyServiceDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000', // Optional: if provided, will connect to existing service
        name: 'Logistics',
        description: 'Full logistics services',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyServiceDto)
  services?: CompanyServiceDto[];

  @ApiPropertyOptional({
    description: 'Array of company city objects to create/update',
    type: [CompanyCityDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000', // Optional: if provided, will update existing
        name: 'Paris Office',
        address: '123 Main St, Paris',
        contactName: 'John Doe',
        contactPhone: '+1234567890',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyCityDto)
  cities?: CompanyCityDto[];
}
