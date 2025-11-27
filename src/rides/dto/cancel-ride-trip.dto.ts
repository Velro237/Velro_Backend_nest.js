import { ApiProperty } from '@nestjs/swagger';

export class CancelRideTripResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'Cancelled trip ID' })
  tripId: string;
}

