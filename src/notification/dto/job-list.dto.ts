import { ApiProperty } from '@nestjs/swagger';

export class JobListResponseDto {
  @ApiProperty({
    description: 'List of waiting job IDs',
    example: ['job-1', 'job-2'],
    type: [String],
  })
  waiting: string[];

  @ApiProperty({
    description: 'List of active job IDs',
    example: ['job-3'],
    type: [String],
  })
  active: string[];

  @ApiProperty({
    description: 'List of completed job IDs',
    example: ['job-4', 'job-5'],
    type: [String],
  })
  completed: string[];

  @ApiProperty({
    description: 'List of failed job IDs',
    example: ['job-6'],
    type: [String],
  })
  failed: string[];

  @ApiProperty({
    description: 'Total number of jobs',
    example: 5,
  })
  total: number;

  @ApiProperty({
    description: 'Success message',
    example: 'Job list retrieved successfully',
  })
  message: string;
}

export class JobDetailsResponseDto {
  @ApiProperty({
    description: 'Job ID',
    example: 'job-123',
  })
  id: string;

  @ApiProperty({
    description: 'Job name',
    example: 'send-email',
  })
  name: string;

  @ApiProperty({
    description: 'Job data (email, name, lang, content)',
    example: {
      email: 'user@example.com',
      name: 'John Doe',
      lang: 'en',
      subject_en: 'Hello',
      subject_fr: 'Bonjour',
    },
  })
  data: any;

  @ApiProperty({
    description: 'Job options',
    example: {
      attempts: 3,
      delay: 0,
    },
  })
  opts: any;

  @ApiProperty({
    description: 'Job progress (0-100)',
    example: 50,
    nullable: true,
  })
  progress: number | null;

  @ApiProperty({
    description: 'Job return value (if completed)',
    example: null,
    nullable: true,
  })
  returnValue: any;

  @ApiProperty({
    description: 'Failure reason (if failed)',
    example: 'Mailgun API error: Invalid email',
    nullable: true,
  })
  failedReason: string | null;

  @ApiProperty({
    description: 'Job creation timestamp',
    example: 1234567890000,
  })
  timestamp: number;

  @ApiProperty({
    description: 'When job was processed',
    example: 1234567891000,
    nullable: true,
  })
  processedOn: number | null;

  @ApiProperty({
    description: 'When job finished',
    example: 1234567892000,
    nullable: true,
  })
  finishedOn: number | null;

  @ApiProperty({
    description: 'Number of attempts made',
    example: 2,
  })
  attemptsMade: number;

  @ApiProperty({
    description: 'Current job state',
    example: 'completed',
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed'],
  })
  state: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Job details retrieved successfully',
  })
  message: string;
}
