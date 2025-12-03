import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendBulkEmailDto {
  @ApiProperty({
    description: 'Email subject in English',
    example: 'Important Update',
  })
  @IsString()
  @MinLength(1)
  subjectEn: string;

  @ApiProperty({
    description: 'Email subject in French',
    example: 'Mise à jour importante',
  })
  @IsString()
  @MinLength(1)
  subjectFr: string;

  @ApiProperty({
    description: 'Email message content in HTML format (English)',
    example:
      '<h1>Hello {user name}</h1><p>We have an important update for you.</p>',
  })
  @IsString()
  @MinLength(1)
  messageEn: string;

  @ApiProperty({
    description: 'Email message content in HTML format (French)',
    example:
      '<h1>Bonjour {user name}</h1><p>Nous avons une mise à jour importante pour vous.</p>',
  })
  @IsString()
  @MinLength(1)
  messageFr: string;
}

export class SendBulkEmailResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Bulk emails sent successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Number of emails sent',
    example: 150,
  })
  emailsSent: number;

  @ApiProperty({
    description: 'Number of emails failed',
    example: 2,
  })
  emailsFailed: number;

  @ApiProperty({
    description: 'Total number of users',
    example: 152,
  })
  totalUsers: number;
}
