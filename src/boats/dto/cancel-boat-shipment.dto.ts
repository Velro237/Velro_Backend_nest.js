import { ApiProperty } from '@nestjs/swagger';

export class CancelBoatShipmentResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Shipment cancelled successfully',
  })
  message: string;

  @ApiProperty({ description: 'Cancelled shipment ID', example: 'trip-uuid-123' })
  shipment_id: string;
}

