import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsArray } from 'class-validator';

export class SendEmailDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
  })
  @IsEmail()
  to: string;

  @ApiProperty({
    description: 'Email subject',
    example: 'Welcome to Velro',
  })
  @IsString()
  subject: string;

  @ApiProperty({
    description: 'Email content in plain text',
    example: 'Thank you for joining Velro!',
    required: false,
  })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiProperty({
    description: 'Email content in HTML format',
    example: '<h1>Welcome to Velro</h1><p>Thank you for joining!</p>',
    required: false,
  })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiProperty({
    description: 'CC email addresses',
    example: ['cc@example.com'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  cc?: string[];

  @ApiProperty({
    description: 'BCC email addresses',
    example: ['bcc@example.com'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  bcc?: string[];
}

export class SendEmailResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Email sent successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Mailgun message ID',
    example: '<20230815123456.1.ABCD@example.com>',
    required: false,
  })
  messageId?: string;
}
