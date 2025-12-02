import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ReportType, ReportPriority, ReportStatus } from 'generated/prisma';

export class GetReportsQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of reports per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by report type',
    enum: ReportType,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @ApiProperty({
    description: 'Filter by report priority',
    enum: ReportPriority,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReportPriority)
  priority?: ReportPriority;

  @ApiProperty({
    description: 'Filter by report status',
    enum: ReportStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiProperty({
    description: 'Filter by trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  trip_id?: string;
}

export class ReportSummaryDto {
  @ApiProperty({
    description: 'Report ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User who created the report',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174005' },
      email: { type: 'string', example: 'reporter@example.com' },
    },
  })
  reporter_user: {
    id: string;
    email: string;
  };

  @ApiProperty({
    description: 'User being reported',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
      email: { type: 'string', example: 'reported@example.com' },
    },
  })
  reported_user: {
    id: string;
    email: string;
  };

  @ApiProperty({
    description: 'Trip information',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174002' },
      pickup: { type: 'object', additionalProperties: true },
      destination: { type: 'object', additionalProperties: true },
      departure_date: { type: 'string', format: 'date-time' },
    },
    additionalProperties: true,
  })
  trip: {
    id: string;
    pickup: any;
    destination: any;
    departure_date: Date;
  };

  @ApiProperty({
    description: 'Request information (if available)',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174003' },
      status: { type: 'string', example: 'PENDING' },
      message: { type: 'string', example: 'I need help with transportation' },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
    additionalProperties: true,
  })
  request?: {
    id: string;
    status: string;
    message?: string;
    created_at: Date;
    updated_at: Date;
  };

  @ApiProperty({
    description: 'Report type',
    enum: ReportType,
    example: ReportType.COMMUNICATION_PROBLEM,
  })
  type: ReportType;

  @ApiProperty({
    description: 'Report priority',
    enum: ReportPriority,
    example: ReportPriority.HIGH,
  })
  priority: ReportPriority;

  @ApiProperty({
    description: 'Report status',
    enum: ReportStatus,
    example: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @ApiProperty({
    description: 'Report text description',
    example: 'User did not show up for pickup',
    required: false,
  })
  text?: string;

  @ApiProperty({
    description: 'Additional structured data for the report',
    example: {
      'Scheduled pickup time': '2:00 PM',
      'How long did you wait?': '45 minutes',
      'Number of attempts to contact': '3 calls and 5 messages',
    },
    required: false,
  })
  data?: Record<string, any>;

  @ApiProperty({
    description: 'Images or documents related to the report',
    example: {
      photos: [
        {
          name: 'evidence-photo-1',
          url: 'https://example.com/images/evidence.jpg',
          description: 'Photo showing empty pickup location',
        },
      ],
    },
    required: false,
  })
  images?: Record<string, any>;

  @ApiProperty({
    description: 'Admin who replied to this report (if any)',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174007' },
      email: { type: 'string', example: 'admin@example.com' },
    },
  })
  replied_by?: {
    id: string;
    email: string;
  };

  @ApiProperty({
    description: 'Number of replies to this report',
    example: 2,
  })
  replies_count: number;

  @ApiProperty({
    description: 'Report creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Report last update timestamp',
    example: '2024-01-15T11:45:00.000Z',
  })
  updated_at: Date;
}

export class GetReportsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Reports retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of reports',
    type: [ReportSummaryDto],
  })
  reports: ReportSummaryDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 10 },
      total: { type: 'number', example: 25 },
      totalPages: { type: 'number', example: 3 },
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
