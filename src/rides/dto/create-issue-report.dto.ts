import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ReportType } from 'generated/prisma';

export class CreateIssueReportDto {
  @ApiProperty({
    description: 'Trip ID to report',
    example: 'trip-uuid',
  })
  @IsString()
  @IsNotEmpty()
  trip_id: string;

  @ApiProperty({
    description: 'Type of issue (matching frontend options)',
    enum: ['DRIVER_WAS_LATE', 'UNSAFE_DRIVING', 'WRONG_ROUTE_TAKEN', 'VEHICLE_CONDITION_ISSUE', 'INAPPROPRIATE_BEHAVIOR', 'OTHER'],
    example: 'DRIVER_WAS_LATE',
  })
  @IsEnum(['DRIVER_WAS_LATE', 'UNSAFE_DRIVING', 'WRONG_ROUTE_TAKEN', 'VEHICLE_CONDITION_ISSUE', 'INAPPROPRIATE_BEHAVIOR', 'OTHER'])
  type: ReportType;

  @ApiPropertyOptional({
    description: 'Additional description (optional)',
    example: 'This trip seems suspicious',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateIssueReportBodyDto {
  @ApiProperty({
    description: 'Type of issue (matching frontend options)',
    enum: ['DRIVER_WAS_LATE', 'UNSAFE_DRIVING', 'WRONG_ROUTE_TAKEN', 'VEHICLE_CONDITION_ISSUE', 'INAPPROPRIATE_BEHAVIOR', 'OTHER'],
    example: 'DRIVER_WAS_LATE',
  })
  @IsEnum(['DRIVER_WAS_LATE', 'UNSAFE_DRIVING', 'WRONG_ROUTE_TAKEN', 'VEHICLE_CONDITION_ISSUE', 'INAPPROPRIATE_BEHAVIOR', 'OTHER'])
  type: ReportType;

  @ApiPropertyOptional({
    description: 'Additional description (optional)',
    example: 'This trip seems suspicious',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateIssueReportResponseDto {
  @ApiProperty({ description: 'Success message', example: 'Report submitted successfully' })
  message: string;

  @ApiProperty({ description: 'Created report ID', example: 'report-uuid-123' })
  reportId: string;
}

