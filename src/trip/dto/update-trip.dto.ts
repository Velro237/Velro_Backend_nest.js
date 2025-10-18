import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTripDto } from './create-trip.dto';
import { TripStatus } from 'generated/prisma/client';

// Status cannot be updated directly - it's automatically managed by the system
export class UpdateTripDto extends PartialType(CreateTripDto) {
  @ApiProperty({
    description: 'Whether the trip is fully booked',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  fully_booked?: boolean;
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
      departure_date: '2024-02-15T10:00:00.000Z',
      departure_time: '10:00 AM',
      arrival_date: '2024-02-16T14:00:00.000Z',
      arrival_time: '02:00 PM',
      status: 'RESCHEDULED',
      fully_booked: false,
      updatedAt: '2024-01-15T10:30:00.000Z',
    },
  })
  trip: {
    id: string;
    user_id: string;
    departure_date: Date;
    departure_time: string;
    arrival_date: Date | null;
    arrival_time: string | null;
    status: TripStatus;
    fully_booked: boolean;
    updatedAt: Date;
  };
}
