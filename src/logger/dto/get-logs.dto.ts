import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { loggerType } from 'generated/prisma';

export class GetLogsQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of logs per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter logs by type. Use "ALL" to get logs of all types.',
    enum: [...Object.values(loggerType), 'ALL'],
    example: loggerType.MESSAGE,
    required: false,
    default: 'ALL',
  })
  @IsOptional()
  @IsIn([...Object.values(loggerType), 'ALL'])
  type?: loggerType | 'ALL' = 'ALL';
}

export class LogDto {
  @ApiProperty({
    description: 'Log ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID associated with the log',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Failed to send message',
  })
  error_message: string;

  @ApiProperty({
    description: 'Logger type',
    enum: loggerType,
    example: loggerType.MESSAGE,
  })
  type: loggerType;

  @ApiProperty({
    description: 'Additional data stored with the log',
    example: {
      context: 'handleSendMessage',
      chatId: '123e4567-e89b-12d3-a456-426614174000',
    },
    required: false,
  })
  data?: any;

  @ApiProperty({
    description: 'Log creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Log last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

export class GetLogsResponseDto {
  @ApiProperty({
    description: 'List of logs',
    type: [LogDto],
  })
  logs: LogDto[];

  @ApiProperty({
    description: 'Total number of logs',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of logs per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}
