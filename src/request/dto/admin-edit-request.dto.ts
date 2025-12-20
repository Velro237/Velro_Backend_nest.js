import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { RequestStatus, PaymentStatus, Currency } from 'generated/prisma';

export class AdminEditRequestDto {
  @ApiProperty({
    description: 'Request status',
    enum: RequestStatus,
    example: RequestStatus.ACCEPTED,
    required: false,
  })
  @IsEnum(RequestStatus)
  @IsOptional()
  status?: RequestStatus;

  @ApiProperty({
    description: 'Request message',
    example: 'I would like to request these items for my upcoming trip',
    required: false,
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiProperty({
    description: 'Request cost',
    example: 100.5,
    required: false,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  cost?: number;

  @ApiProperty({
    description: 'Currency',
    enum: Currency,
    example: Currency.EUR,
    required: false,
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCEEDED,
    required: false,
  })
  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @ApiProperty({
    description: 'Payment intent ID',
    example: 'pi_1234567890',
    required: false,
  })
  @IsString()
  @IsOptional()
  payment_intent_id?: string;
}

export class AdminEditRequestResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated request information',
    type: Object,
    additionalProperties: true,
  })
  request: {
    id: string;
    trip_id: string;
    user_id: string;
    status: RequestStatus;
    message?: string;
    cost?: number;
    currency?: Currency;
    payment_status?: PaymentStatus;
    payment_intent_id?: string;
    updated_at: Date;
  };
}
