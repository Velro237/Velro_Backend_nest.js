import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  Validate,
} from 'class-validator';
import { AlertDateValidationConstraint } from './create-alert.dto';

export class UpdateAlertDto {
  @ApiProperty({
    description: 'Departure location for the alert',
    example: 'New York',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  depature?: string;

  @ApiProperty({
    description: 'Destination location for the alert',
    example: 'Los Angeles',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  destination?: string;

  @ApiProperty({
    description: 'Whether to send notifications for this alert',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  notificaction?: boolean;

  @ApiProperty({
    description: 'Start date for the alert (optional)',
    example: '2024-01-15T00:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  form_date?: string;

  @ApiProperty({
    description: 'End date for the alert (optional)',
    example: '2024-01-20T00:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  to_date?: string;

  // Custom validation for date rules
  @Validate(AlertDateValidationConstraint)
  dateValidation?: any;
}

export class UpdateAlertResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Alert updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated alert data',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      depature: 'New York',
      destination: 'Los Angeles',
      notificaction: true,
      form_date: '2024-01-15T00:00:00.000Z',
      to_date: '2024-01-20T00:00:00.000Z',
      created_at: '2024-01-10T10:00:00.000Z',
      updated_at: '2024-01-10T10:00:00.000Z',
    },
  })
  alert: {
    id: string;
    user_id: string;
    depature: string;
    destination: string;
    notificaction: boolean;
    form_date: Date | null;
    to_date: Date | null;
    created_at: Date;
    updated_at: Date;
  };
}
