import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsUUID,
  IsOptional,
  IsObject,
  IsString,
} from 'class-validator';
import { ReportPriority } from 'generated/prisma';

export class ReplyReportDto {
  @ApiProperty({
    description: 'ID of the report to reply to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  report_id: string;

  @ApiProperty({
    description: 'Reply text content',
    example:
      'Thank you for reporting this issue. We have investigated and taken appropriate action.',
  })
  @IsString()
  text: string;

  @ApiProperty({
    description: 'Priority of the reply',
    enum: ReportPriority,
    example: ReportPriority.HIGH,
  })
  @IsEnum(ReportPriority)
  priority: ReportPriority;

  @ApiProperty({
    description: 'Additional data in key-value pair format (optional)',
    type: 'object',
    example: {
      'Action taken': 'User account suspended',
      'Investigation notes': 'Verified complaint with evidence',
    },
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @ApiProperty({
    description: 'Images related to the reply (JSON object)',
    example: {
      documents: [
        {
          name: 'admin-response-1',
          url: 'https://example.com/docs/admin-response.pdf',
          data: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFI+PgplbmRvYmoK...',
          description: 'Admin response documentation',
        },
      ],
    },
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  images?: Record<string, any>;
}

export class ReplyReportResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Report reply created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created reply report information',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
      user_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174003',
        description: 'Original reporter ID (same as original report)',
      },
      reported_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174004',
        description: 'Reported user ID (same as original report)',
      },
      reply_to_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174000',
      },
      trip_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174004',
      },
      type: { type: 'string', example: 'RESPONSE_TO_REPORT' },
      priority: { type: 'string', example: 'HIGH' },
      status: { type: 'string', example: 'REPLIED' },
      created_at: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  reply: {
    id: string;
    user_id: string;
    reported_id: string;
    reply_to_id: string;
    trip_id: string;
    type: string;
    priority: string;
    status: string;
    created_at: Date;
  };
}
