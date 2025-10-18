import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from 'generated/prisma';

export class GetNotificationsQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Number of notifications per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}

export class NotificationSummaryDto {
  @ApiProperty({
    description: 'Notification ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  user_id: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'New Trip Request',
  })
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'You have received a new trip request from John Doe',
  })
  message: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
    example: 'REQUEST',
  })
  type: NotificationType;

  @ApiProperty({
    description: 'Additional data for the notification',
    example: { tripId: '123e4567-e89b-12d3-a456-426614174002' },
    nullable: true,
  })
  data: any | null;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  read: boolean;

  @ApiProperty({
    description: 'Notification creation date',
    example: '2024-01-10T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Notification read date',
    example: '2024-01-10T11:00:00.000Z',
    nullable: true,
  })
  read_at: Date | null;

  @ApiProperty({
    description: 'User who owns this notification',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'user@example.com',
      name: 'John Doe',
      picture: 'https://example.com/avatar.jpg',
    },
  })
  user: {
    id: string;
    email: string;
    name: string;
    picture: string | null;
  };
}

export class GetNotificationsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Notifications retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of notifications',
    type: [NotificationSummaryDto],
  })
  notifications: NotificationSummaryDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  @ApiProperty({
    description: 'Count of unread notifications',
    example: 5,
  })
  unreadCount: number;
}
