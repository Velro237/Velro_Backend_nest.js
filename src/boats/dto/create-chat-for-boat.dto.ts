import { ApiProperty } from '@nestjs/swagger';

export class CreateChatForBoatDto {
  @ApiProperty({
    description: 'Boat shipment ID',
    example: 'trip-uuid-123',
  })
  shipment_id: string;
}

export class CreateChatForBoatResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Chat created successfully',
  })
  message: string;

  @ApiProperty({ description: 'Chat ID', example: 'chat-uuid-123' })
  chat_id: string;

  @ApiProperty({
    description: 'Ship owner user ID',
    example: 'user-uuid-123',
  })
  ship_owner_id: string;
}

