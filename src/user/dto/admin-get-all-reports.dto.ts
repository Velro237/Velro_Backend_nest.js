import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ReportType, ReportPriority, ReportStatus } from 'generated/prisma';

export class AdminGetAllReportsQueryDto {
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

  @ApiProperty({
    description: 'Filter by user ID (either reporter or reported user)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  user_id?: string;

  @ApiProperty({
    description: 'Filter by admin who replied to the report',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  replied_by?: string;

  @ApiProperty({
    description: 'Filter reports created after this date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({
    description: 'Filter reports created before this date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;
}

export class AdminGetAllReportsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'All reports retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of reports',
    type: 'array',
  })
  reports: any[];

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
