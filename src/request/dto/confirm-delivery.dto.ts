import { ApiProperty } from '@nestjs/swagger';

export class ConfirmDeliveryResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Delivery confirmed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Whether both parties have confirmed',
    example: false,
  })
  bothConfirmed: boolean;

  @ApiProperty({
    description: 'Sender confirmed delivery',
    example: true,
  })
  senderConfirmed: boolean;

  @ApiProperty({
    description: 'Traveler confirmed delivery',
    example: false,
  })
  travelerConfirmed: boolean;

  @ApiProperty({
    description: 'Whether earnings have been released to available balance',
    example: false,
  })
  earningsReleased: boolean;
}

