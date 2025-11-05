import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional } from 'class-validator';

export class SendPushNotificationDto {
  @ApiProperty({
    description: 'Notification title',
    example: 'New Trip Alert',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Notification body',
    example: 'A new trip matches your alert criteria',
  })
  @IsString()
  body: string;

  @ApiProperty({
    description: 'Device token for push notification (FCM token)',
    example: 'expo_push_token_here',
  })
  @IsString()
  deviceId: string;

  @ApiProperty({
    description: 'Additional data to send with the notification',
    example: { request_id: '123e4567-e89b-12d3-a456-426614174001' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

export class SendPushNotificationResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Push notification sent successfully',
  })
  message: string;
}
