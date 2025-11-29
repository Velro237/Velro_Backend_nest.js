import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateChatForRideDto {
  @ApiProperty({
    description: 'Ride trip ID',
    example: 'trip-uuid',
  })
  @IsString()
  @IsNotEmpty()
  trip_id: string;
}

export class CreateChatForRideResponseDto {
  @ApiProperty({ description: 'Chat ID' })
  chatId: string;

  @ApiProperty({ description: 'Success message' })
  message: string;
}

