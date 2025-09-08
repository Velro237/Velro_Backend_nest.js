import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';

import { TripStatus } from 'generated/prisma/client';
import { CreateTripDto } from 'src/trip/dto/create-trip.dto';

export class UpdateTripDto extends PartialType(CreateTripDto) {
  @ApiProperty({
    description: 'Trip status',
    enum: TripStatus,
    example: TripStatus.CANCELLED,
    required: false,
  })
  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;
}

export class UpdateTripResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated trip information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      travel_date: '2024-02-15T10:00:00.000Z',
      travel_time: '10:00 AM',
      price_per_kg: 15.5,
      status: 'CANCELLED',
      updatedAt: '2024-01-15T10:30:00.000Z',
    },
  })
  trip: {
    id: string;
    user_id: string;
    travel_date: Date;
    travel_time: string;
    price_per_kg: any; // Decimal from Prisma
    status: TripStatus;
    updatedAt: Date;
  };
}
