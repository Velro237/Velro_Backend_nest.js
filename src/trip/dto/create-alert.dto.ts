import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  ValidateIf,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'AlertDateValidation', async: false })
export class AlertDateValidationConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const fromDate = object.form_date;
    const toDate = object.to_date;

    // If from_date is provided, to_date must also be provided
    if (fromDate && !toDate) {
      return false;
    }

    // If both dates are provided, validate them
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day

      // from_date must be greater than today
      if (from <= today) {
        return false;
      }

      // to_date must be greater than from_date
      if (to <= from) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    const fromDate = object.form_date;
    const toDate = object.to_date;

    if (fromDate && !toDate) {
      return 'If from_date is provided, to_date must also be provided';
    }

    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (from <= today) {
        return 'from_date must be greater than today';
      }

      if (to <= from) {
        return 'to_date must be greater than from_date';
      }
    }

    return 'Invalid date validation';
  }
}

export class CreateAlertDto {
  @ApiProperty({
    description: 'Departure location for the alert',
    example: 'New York',
  })
  @IsString()
  @IsNotEmpty()
  depature: string;

  @ApiProperty({
    description: 'Destination location for the alert',
    example: 'Los Angeles',
  })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({
    description: 'Whether to send notifications for this alert',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  notificaction?: boolean = true;

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

export class CreateAlertResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Alert created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created alert data',
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
