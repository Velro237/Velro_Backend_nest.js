import { ApiProperty } from '@nestjs/swagger';

export class AdminDeleteTripResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip deleted successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Deleted trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tripId: string;
}
