import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { RequestStatus } from 'generated/prisma/client';

export class UpdateTripRequestDto {
  @ApiProperty({
    description: 'Request status',
    enum: RequestStatus,
    example: RequestStatus.APPROVED,
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
}

export class UpdateTripRequestResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip request updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated trip request information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174002',
      trip_id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'APPROVED',
      message: 'I would like to request these items for my upcoming trip',
      updated_at: '2024-01-15T10:30:00.000Z',
    },
  })
  request: {
    id: string;
    trip_id: string;
    user_id: string;
    status: RequestStatus;
    message?: string;
    updated_at: Date;
  };
}
