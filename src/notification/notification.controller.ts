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
import { SendEmailDto, SendEmailResponseDto } from './dto/send-email.dto';
import {
  NotificationBulkEmailDto,
  NotificationBulkEmailResponseDto,
} from './dto/send-bulk-email.dto';
import { BulkEmailStatsResponseDto } from './dto/bulk-email-stats.dto';
import {
  ApiGetNotifications,
  ApiUpdateReadStatus,
  ApiDeleteNotification,
} from './decorators/api-docs.decorator';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
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
  SendEmailDto,
  SendEmailResponseDto,
  NotificationBulkEmailDto,
  NotificationBulkEmailResponseDto,
  BulkEmailStatsResponseDto,
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
          deviceId: 'token here',
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

  @Post('email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send email via Mailgun',
    description:
      'Send an email using Mailgun API. Requires MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables to be configured. Either text or html content must be provided.',
  })
  @ApiBody({
    type: SendEmailDto,
    description: 'Email data',
    examples: {
      'Text Email': {
        summary: 'Simple text email',
        description: 'Example of a plain text email',
        value: {
          to: 'recipient@example.com',
          subject: 'Welcome to Velro',
          text: 'Thank you for joining Velro! We are excited to have you on board.',
        },
      },
      'HTML Email': {
        summary: 'HTML formatted email',
        description: 'Example of an HTML email with styling',
        value: {
          to: 'recipient@example.com',
          subject: 'Welcome to Velro',
          html: '<h1>Welcome to Velro</h1><p>Thank you for joining! We are <strong>excited</strong> to have you on board.</p>',
        },
      },
      'Email with CC and BCC': {
        summary: 'Email with CC and BCC recipients',
        description: 'Example with multiple recipients',
        value: {
          to: 'recipient@example.com',
          subject: 'Team Update',
          text: 'This is a team update email',
          cc: ['cc1@example.com', 'cc2@example.com'],
          bcc: ['bcc@example.com'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Email sent successfully',
    type: SendEmailResponseDto,
    example: {
      message: 'Email sent successfully',
      messageId: '<20230815123456.1.ABCD@example.com>',
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Missing email content or invalid Mailgun configuration',
    example: {
      statusCode: 400,
      message: 'Either text or html content must be provided',
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    example: {
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Failed to send email',
    example: {
      statusCode: 500,
      message: 'Failed to send email',
      error: 'Internal Server Error',
    },
  })
  async sendEmail(
    @Body() emailDto: SendEmailDto,
    @I18nLang() lang: string,
  ): Promise<SendEmailResponseDto> {
    return this.notificationService.sendEmail(emailDto, lang);
  }

  @Post('email/bulk')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send bulk emails to all users',
    description:
      "Send bulk emails to users using a background job queue. Emails are processed asynchronously to avoid blocking the server. Supports multilingual content (English and French) - emails are automatically sent in the user's preferred language. Supports name personalization using {{name}} placeholder in HTML/text content. Supports filtering by user status or specific email addresses. Requires admin privileges.",
  })
  @ApiBody({
    type: NotificationBulkEmailDto,
    description: 'Bulk email data',
    examples: {
      'All Users': {
        summary: 'Send to all users',
        description: 'Send email to all users in the system',
        value: {
          subject_en: 'Important Update',
          subject_fr: 'Mise à jour importante',
          html_en:
            '<h1>Important Update</h1><p>Hello {{name}}, this is an important message for all users.</p>',
          html_fr:
            '<h1>Mise à jour importante</h1><p>Bonjour {{name}}, ceci est un message important pour tous les utilisateurs.</p>',
          text_en:
            'Hello {{name}}, this is an important message for all users.',
          text_fr:
            'Bonjour {{name}}, ceci est un message important pour tous les utilisateurs.',
          filter: 'ALL',
        },
      },
      'Active Users Only': {
        summary: 'Send to active users only',
        description: 'Send email only to active users',
        value: {
          subject_en: 'Welcome Back!',
          subject_fr: 'Bon retour !',
          html_en:
            '<h1>Welcome Back!</h1><p>Hello {{name}}, we missed you!</p>',
          html_fr:
            '<h1>Bon retour !</h1><p>Bonjour {{name}}, vous nous avez manqué !</p>',
          filter: 'ACTIVE',
        },
      },
      'Specific Emails': {
        summary: 'Send to specific email addresses',
        description: 'Send email to a list of specific email addresses',
        value: {
          subject_en: 'Special Offer',
          subject_fr: 'Offre spéciale',
          html_en: '<h1>Special Offer</h1><p>Hello {{name}}, just for you!</p>',
          html_fr:
            '<h1>Offre spéciale</h1><p>Bonjour {{name}}, juste pour vous !</p>',
          emails: ['user1@example.com', 'user2@example.com'],
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Bulk email sending started in background',
    type: NotificationBulkEmailResponseDto,
    example: {
      message: 'Bulk email sending started in background',
      queuedCount: 5000,
      jobId: 'job-123456',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Missing email content',
    example: {
      statusCode: 400,
      message: 'Either text or html content must be provided',
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async sendBulkEmail(
    @Body() bulkEmailDto: NotificationBulkEmailDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<NotificationBulkEmailResponseDto> {
    return this.notificationService.sendBulkEmail(bulkEmailDto, user, lang);
  }

  @Get('email/bulk/stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get bulk email statistics',
    description:
      'Get statistics about bulk email sending jobs including waiting, active, completed, and failed counts. Also includes success and failure rates. Requires admin privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk email statistics retrieved successfully',
    type: BulkEmailStatsResponseDto,
    example: {
      waiting: 150,
      active: 5,
      completed: 4850,
      failed: 10,
      total: 5015,
      successRate: 96.8,
      failureRate: 0.2,
      message: 'Bulk email statistics retrieved successfully',
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
    example: {
      statusCode: 403,
      message: 'Only administrators can view bulk email statistics',
      error: 'Forbidden',
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    example: {
      statusCode: 500,
      message: 'Failed to retrieve bulk email statistics',
      error: 'Internal Server Error',
    },
  })
  async getBulkEmailStats(
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<BulkEmailStatsResponseDto> {
    return this.notificationService.getBulkEmailStats(user, lang);
  }
}
