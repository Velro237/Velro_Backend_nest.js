import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
} from 'class-validator';
import { NotificationType } from 'generated/prisma';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'User ID to send notification to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'New Trip Request',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'You have received a new trip request from John Doe',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
    example: 'REQUEST',
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Additional data for the notification',
    example: {
      tripId: '123e4567-e89b-12d3-a456-426614174001',
      requestId: '123e4567-e89b-12d3-a456-426614174002',
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

export class CreateNotificationResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Notification created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created notification data',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'New Trip Request',
      message: 'You have received a new trip request from John Doe',
      type: 'REQUEST',
      data: { tripId: '123e4567-e89b-12d3-a456-426614174002' },
      read: false,
      createdAt: '2024-01-10T10:00:00.000Z',
      read_at: null,
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
