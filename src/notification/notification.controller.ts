import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiExtraModels,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  GetNotificationsQueryDto,
  GetNotificationsResponseDto,
} from './dto/get-notifications.dto';
import { DeleteNotificationResponseDto } from './dto/delete-notification.dto';
import {
  UpdateReadStatusDto,
  UpdateReadStatusResponseDto,
} from './dto/update-read-status.dto';
import {
  SendPushNotificationDto,
  SendPushNotificationResponseDto,
} from './dto/send-push-notification.dto';
import {
  ApiGetNotifications,
  ApiUpdateReadStatus,
  ApiDeleteNotification,
} from './decorators/api-docs.decorator';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@ApiExtraModels(
  GetNotificationsQueryDto,
  GetNotificationsResponseDto,
  DeleteNotificationResponseDto,
  UpdateReadStatusDto,
  UpdateReadStatusResponseDto,
  SendPushNotificationDto,
  SendPushNotificationResponseDto,
)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiGetNotifications()
  async getUserNotifications(
    @Query() query: GetNotificationsQueryDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetNotificationsResponseDto> {
    return this.notificationService.getUserNotifications(
      user.id,
      query.page,
      query.limit,
      lang,
    );
  }

  @Patch(':id/read-status')
  @ApiUpdateReadStatus()
  async updateReadStatus(
    @Param('id') notificationId: string,
    @Body() updateReadStatusDto: UpdateReadStatusDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<UpdateReadStatusResponseDto> {
    return this.notificationService.updateReadStatus(
      notificationId,
      user.id,
      updateReadStatusDto,
      lang,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiDeleteNotification()
  async deleteNotification(
    @Param('id') notificationId: string,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<DeleteNotificationResponseDto> {
    return this.notificationService.deleteNotification(
      notificationId,
      user.id,
      lang,
    );
  }

  @Post('push')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send push notification',
    description:
      'Send a push notification to a specific device with optional data payload',
  })
  @ApiBody({
    type: SendPushNotificationDto,
    description: 'Push notification data',
    examples: {
      'Trip Alert': {
        summary: 'Trip Alert Notification',
        description: 'Example of a trip alert notification with request data',
        value: {
          title: 'New Trip Alert',
          body: 'A new trip matches your alert criteria',
          deviceId: 'fcm_token_here',
          data: {
            request_id: '123e4567-e89b-12d3-a456-426614174001',
            type: 'trip_alert',
          },
        },
      },
      'Simple Notification': {
        summary: 'Simple Notification',
        description: 'Example of a simple notification without data',
        value: {
          title: 'Welcome!',
          body: 'Welcome to Velro',
          deviceId: 'fcm_token_here',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Push notification sent successfully',
    type: SendPushNotificationResponseDto,
    example: {
      message: 'Push notification sent successfully',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
    example: {
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Failed to send notification',
    example: {
      statusCode: 500,
      message: 'Failed to send push notification',
      error: 'Internal Server Error',
    },
  })
  async sendPushNotification(
    @Body() pushNotificationDto: SendPushNotificationDto,
    @I18nLang() lang: string,
  ): Promise<SendPushNotificationResponseDto> {
    return this.notificationService.sendPushNotification(
      pushNotificationDto,
      lang,
    );
  }
}
