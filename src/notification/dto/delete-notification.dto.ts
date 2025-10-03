import { ApiProperty } from '@nestjs/swagger';

export class DeleteNotificationResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Notification deleted successfully',
  })
  message: string;
}
