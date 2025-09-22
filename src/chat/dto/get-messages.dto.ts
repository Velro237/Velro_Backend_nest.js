import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { MessageResponseDto } from './send-message.dto';

export class GetMessagesQueryDto {
  @ApiProperty({
    description: 'Chat ID to get messages from',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  chatId: string;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of messages per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class GetMessagesResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Messages retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of messages',
    type: [MessageResponseDto],
  })
  messages: MessageResponseDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 20 },
      total: { type: 'number', example: 150 },
      totalPages: { type: 'number', example: 8 },
      hasNext: { type: 'boolean', example: true },
      hasPrev: { type: 'boolean', example: false },
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
