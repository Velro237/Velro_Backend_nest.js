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
    description: 'Type of issue for boat shipments (each description has a unique type)',
    enum: ['PACKAGE_ISSUE', 'PACKAGE_LOST', 'PAYMENT_PROBLEM', 'POLICY_VIOLATION', 'DELAYED_DEPARTURE', 'OTHER'],
    example: 'PACKAGE_ISSUE',
    examples: {
      packageDamaged: { value: 'PACKAGE_ISSUE', summary: 'Package damaged' },
      packageLost: { value: 'PACKAGE_LOST', summary: 'Package lost or missing' },
      hiddenFees: { value: 'PAYMENT_PROBLEM', summary: 'Hidden fees or charges' },
      customsDeclaration: { value: 'POLICY_VIOLATION', summary: 'Incorrect customs declaration' },
      delayedDeparture: { value: 'DELAYED_DEPARTURE', summary: 'Delayed departure/arrival' },
      other: { value: 'OTHER', summary: 'Other' },
    },
  })
  @IsEnum(['PACKAGE_ISSUE', 'PACKAGE_LOST', 'PAYMENT_PROBLEM', 'POLICY_VIOLATION', 'DELAYED_DEPARTURE', 'OTHER'])
  type: ReportType;

  @ApiPropertyOptional({
    description: 'Additional description (optional)',
    example: 'Package was damaged during shipment',
    examples: {
      packageDamaged: { value: 'Package was damaged during shipment', summary: 'Package damaged' },
      packageLost: { value: 'Package was lost or missing during shipment', summary: 'Package lost' },
      delayedDeparture: { value: 'Departure or arrival was delayed', summary: 'Delayed departure/arrival' },
      other: { value: 'Other issue not listed above', summary: 'Other issue' },
    },
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class BoatCreateIssueReportBodyDto {
  @ApiProperty({
    description: 'Type of issue for boat shipments (each description has a unique type)',
    enum: ['PACKAGE_ISSUE', 'PACKAGE_LOST', 'PAYMENT_PROBLEM', 'POLICY_VIOLATION', 'DELAYED_DEPARTURE', 'OTHER'],
    example: 'PACKAGE_ISSUE',
    examples: {
      packageDamaged: { value: 'PACKAGE_ISSUE', summary: 'Package damaged' },
      packageLost: { value: 'PACKAGE_LOST', summary: 'Package lost or missing' },
      hiddenFees: { value: 'PAYMENT_PROBLEM', summary: 'Hidden fees or charges' },
      customsDeclaration: { value: 'POLICY_VIOLATION', summary: 'Incorrect customs declaration' },
      delayedDeparture: { value: 'DELAYED_DEPARTURE', summary: 'Delayed departure/arrival' },
      other: { value: 'OTHER', summary: 'Other' },
    },
  })
  @IsEnum(['PACKAGE_ISSUE', 'PACKAGE_LOST', 'PAYMENT_PROBLEM', 'POLICY_VIOLATION', 'DELAYED_DEPARTURE', 'OTHER'])
  type: ReportType;

  @ApiPropertyOptional({
    description: 'Additional description (optional)',
    example: 'Package was damaged during shipment',
    examples: {
      packageDamaged: { value: 'Package was damaged during shipment', summary: 'Package damaged' },
      packageLost: { value: 'Package was lost or missing during shipment', summary: 'Package lost' },
      delayedDeparture: { value: 'Departure or arrival was delayed', summary: 'Delayed departure/arrival' },
      other: { value: 'Other issue not listed above', summary: 'Other issue' },
    },
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

