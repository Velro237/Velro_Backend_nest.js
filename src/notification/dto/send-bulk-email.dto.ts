import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEmail,
  IsEnum,
} from 'class-validator';

export enum BulkEmailFilter {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class NotificationBulkEmailDto {
  @ApiProperty({
    description: 'Email subject in English',
    example: 'Important Update from Velro',
  })
  @IsString()
  subject_en: string;

  @ApiProperty({
    description: 'Email subject in French',
    example: 'Mise à jour importante de Velro',
  })
  @IsString()
  subject_fr: string;

  @ApiProperty({
    description:
      'Email content in plain text (English). Supports {{name}} placeholder for user name.',
    example: 'Hello {{name}}, this is an important update for all users.',
    required: false,
  })
  @IsOptional()
  @IsString()
  text_en?: string;

  @ApiProperty({
    description:
      'Email content in plain text (French). Supports {{name}} placeholder for user name.',
    example:
      'Bonjour {{name}}, ceci est une mise à jour importante pour tous les utilisateurs.',
    required: false,
  })
  @IsOptional()
  @IsString()
  text_fr?: string;

  @ApiProperty({
    description:
      'Email content in HTML format (English). Supports {{name}} placeholder for user name.',
    example:
      '<h1>Important Update</h1><p>Hello {{name}}, this is an important update for all users.</p>',
    required: false,
  })
  @IsOptional()
  @IsString()
  html_en?: string;

  @ApiProperty({
    description:
      'Email content in HTML format (French). Supports {{name}} placeholder for user name.',
    example:
      '<h1>Mise à jour importante</h1><p>Bonjour {{name}}, ceci est une mise à jour importante pour tous les utilisateurs.</p>',
    required: false,
  })
  @IsOptional()
  @IsString()
  html_fr?: string;

  @ApiProperty({
    description: 'Filter users to send emails to',
    enum: BulkEmailFilter,
    example: BulkEmailFilter.ALL,
    default: BulkEmailFilter.ALL,
    required: false,
  })
  @IsOptional()
  @IsEnum(BulkEmailFilter)
  filter?: BulkEmailFilter = BulkEmailFilter.ALL;

  @ApiProperty({
    description:
      'Specific email addresses to send to (optional, overrides filter)',
    type: [String],
    required: false,
    example: ['user1@example.com', 'user2@example.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];
}

export class NotificationBulkEmailResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Bulk email sending started in background',
  })
  message: string;

  @ApiProperty({
    description: 'Number of emails queued',
    example: 5000,
  })
  queuedCount: number;

  @ApiProperty({
    description: 'Job ID for tracking progress',
    example: 'job-123456',
  })
  jobId: string;
}
