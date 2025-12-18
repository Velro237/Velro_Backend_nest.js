import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { ReportStatus } from 'generated/prisma';

export class AdminChangeReportStatusDto {
  @ApiProperty({
    description: 'ID of the report to update',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  report_id: string;

  @ApiProperty({
    description: 'New status for the report',
    enum: ReportStatus,
    example: ReportStatus.INVESTIGATION,
  })
  @IsEnum(ReportStatus)
  status: ReportStatus;
}

export class AdminChangeReportStatusResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Report status updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated report information',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      status: { type: 'string', example: 'INVESTIGATION' },
      updated_at: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  report: {
    id: string;
    status: string;
    updated_at: Date;
  };
}
