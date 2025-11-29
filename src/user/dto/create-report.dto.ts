import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsUUID,
  IsOptional,
  IsObject,
  IsString,
} from 'class-validator';
import { ReportType, ReportPriority } from 'generated/prisma';

export class ReportImageDto {
  @ApiProperty({
    description: 'Image name',
    example: 'evidence-photo-1',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Image URL',
    example: 'https://example.com/images/evidence.jpg',
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Base64 image data',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...',
  })
  @IsString()
  data: string;

  @ApiProperty({
    description: 'Image description',
    example: 'Photo showing damaged items received',
  })
  @IsString()
  description: string;
}

export class CreateReportDto {
  @ApiProperty({
    description: 'ID of the user being reported',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  reported_id: string;

  @ApiProperty({
    description: 'ID of report we are replying to (optional)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  reply_to_id?: string;

  @ApiProperty({
    description: 'Trip ID (required)',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID('4')
  trip_id: string;

  @ApiProperty({
    description: 'Request ID (optional)',
    example: '123e4567-e89b-12d3-a456-426614174003',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  request_id?: string;

  @ApiProperty({
    description: 'Type of report. Accepts all ReportType enum values.',
    enum: ReportType,
    example: ReportType.TRAVEL_ISSUES,
    enumName: 'ReportType',
  })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({
    description: 'Report text description',
    example: 'User did not show up for the scheduled pickup time',
    required: false,
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({
    description: 'Priority of the report',
    enum: ReportPriority,
    example: ReportPriority.HIGH,
  })
  @IsEnum(ReportPriority)
  priority: ReportPriority;

  @ApiProperty({
    description: 'Additional data as key-value pairs (question-answer format)',
    example: {
      'What time was the pickup scheduled?': '2:00 PM',
      'How long did you wait?': '30 minutes',
      'Did you try to contact the user?': 'Yes, but no response',
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @ApiProperty({
    description: 'Images related to the report (JSON object)',
    example: {
      photos: [
        {
          name: 'evidence-photo-1',
          url: 'https://example.com/images/evidence.jpg',
          data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...',
          description: 'Photo showing empty pickup location',
        },
      ],
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  images?: Record<string, any>;
}

export class CreateReportResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Report created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created report data',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      user_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174001',
      },
      reported_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174002',
      },
      trip_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174003',
      },
      type: { type: 'string', example: 'TRAVEL_ISSUES' },
      priority: { type: 'string', example: 'HIGH' },
      status: { type: 'string', example: 'PENDING' },
      created_at: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  report: {
    id: string;
    user_id: string;
    reported_id: string;
    trip_id: string;
    type: string;
    priority: string;
    status: string;
    created_at: Date;
  };
}
