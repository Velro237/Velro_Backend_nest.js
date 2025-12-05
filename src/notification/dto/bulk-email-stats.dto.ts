import { ApiProperty } from '@nestjs/swagger';

export class BulkEmailStatsResponseDto {
  @ApiProperty({
    description: 'Number of emails waiting to be processed',
    example: 150,
  })
  waiting: number;

  @ApiProperty({
    description: 'Number of emails currently being processed',
    example: 5,
  })
  active: number;

  @ApiProperty({
    description: 'Number of successfully sent emails',
    example: 4850,
  })
  completed: number;

  @ApiProperty({
    description: 'Number of failed emails',
    example: 10,
  })
  failed: number;

  @ApiProperty({
    description:
      'Total number of emails in the queue (waiting + active + completed + failed)',
    example: 5015,
  })
  total: number;

  @ApiProperty({
    description: 'Success rate percentage (completed / total * 100)',
    example: 96.8,
    nullable: true,
  })
  successRate: number | null;

  @ApiProperty({
    description: 'Failure rate percentage (failed / total * 100)',
    example: 0.2,
    nullable: true,
  })
  failureRate: number | null;

  @ApiProperty({
    description: 'Success message',
    example: 'Bulk email statistics retrieved successfully',
  })
  message: string;
}
