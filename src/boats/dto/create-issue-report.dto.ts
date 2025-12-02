import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { ReportType } from 'generated/prisma';

export class CreateIssueReportDto {
  @ApiProperty({
    description: 'Shipment ID to report',
    example: 'trip-uuid',
  })
  @IsString()
  @IsNotEmpty()
  shipment_id: string;

  @ApiProperty({
    description: 'Type of issue for boat shipments (matching Figma design)',
    enum: ['PACKAGE_ISSUE', 'PAYMENT_PROBLEM', 'POLICY_VIOLATION', 'OTHER'],
    example: 'PACKAGE_ISSUE',
    examples: {
      packageDamaged: { value: 'PACKAGE_ISSUE', summary: 'Package damaged' },
      packageLost: { value: 'PACKAGE_ISSUE', summary: 'Package lost or missing' },
      hiddenFees: { value: 'PAYMENT_PROBLEM', summary: 'Hidden fees or charges' },
      customsDeclaration: { value: 'POLICY_VIOLATION', summary: 'Incorrect customs declaration' },
      delayedDeparture: { value: 'OTHER', summary: 'Delayed departure/arrival' },
      other: { value: 'OTHER', summary: 'Other' },
    },
  })
  @IsEnum(['PACKAGE_ISSUE', 'PAYMENT_PROBLEM', 'POLICY_VIOLATION', 'OTHER'])
  type: ReportType;

  @ApiPropertyOptional({
    description: 'Additional description (optional)',
    example: 'Package was damaged during shipment',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateIssueReportBodyDto {
  @ApiProperty({
    description: 'Type of issue for boat shipments (matching Figma design)',
    enum: ['PACKAGE_ISSUE', 'PAYMENT_PROBLEM', 'POLICY_VIOLATION', 'OTHER'],
    example: 'PACKAGE_ISSUE',
    examples: {
      packageDamaged: { value: 'PACKAGE_ISSUE', summary: 'Package damaged' },
      packageLost: { value: 'PACKAGE_ISSUE', summary: 'Package lost or missing' },
      hiddenFees: { value: 'PAYMENT_PROBLEM', summary: 'Hidden fees or charges' },
      customsDeclaration: { value: 'POLICY_VIOLATION', summary: 'Incorrect customs declaration' },
      delayedDeparture: { value: 'OTHER', summary: 'Delayed departure/arrival' },
      other: { value: 'OTHER', summary: 'Other' },
    },
  })
  @IsEnum(['PACKAGE_ISSUE', 'PAYMENT_PROBLEM', 'POLICY_VIOLATION', 'OTHER'])
  type: ReportType;

  @ApiPropertyOptional({
    description: 'Additional description (optional)',
    example: 'Package was damaged during shipment',
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

