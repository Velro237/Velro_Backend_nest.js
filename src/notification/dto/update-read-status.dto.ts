import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { NotificationType } from 'generated/prisma';

export class UpdateReadStatusDto {
  @ApiProperty({
    description: 'Read status of the notification',
    example: true,
  })
  @IsBoolean()
  read: boolean;
}

export class UpdateReadStatusResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Notification read status updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated notification data',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'New Trip Request',
      message: 'You have received a new trip request from John Doe',
      type: 'REQUEST',
      data: { tripId: '123e4567-e89b-12d3-a456-426614174002' },
      read: true,
      createdAt: '2024-01-10T10:00:00.000Z',
      read_at: '2024-01-10T11:00:00.000Z',
    },
  })
  notification: {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    data: any | null;
    read: boolean;
    createdAt: Date;
    read_at: Date | null;
  };
}
