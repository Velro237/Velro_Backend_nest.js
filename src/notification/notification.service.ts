import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  CreateNotificationDto,
  CreateNotificationResponseDto,
} from './dto/create-notification.dto';
import { GetNotificationsResponseDto } from './dto/get-notifications.dto';
import { DeleteNotificationResponseDto } from './dto/delete-notification.dto';
import {
  UpdateReadStatusDto,
  UpdateReadStatusResponseDto,
} from './dto/update-read-status.dto';
import { NotificationType } from 'generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { Inject } from '@nestjs/common';
import {
  SendPushNotificationDto,
  SendPushNotificationResponseDto,
} from './dto/send-push-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject('FIREBASE_ADMIN') private readonly firebaseAdmin: any,
  ) {}

  async createNotification(
    createNotificationDto: CreateNotificationDto,
    lang: string,
  ): Promise<CreateNotificationResponseDto> {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: {
          id: createNotificationDto.user_id,
        },
      });

      if (!user) {
        const message = await this.i18n.translate(
          'translation.notification.userNotFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      // Create notification
      const notification = await this.prisma.notification.create({
        data: {
          user_id: createNotificationDto.user_id,
          title: createNotificationDto.title,
          message: createNotificationDto.message,
          type: createNotificationDto.type,
          data: createNotificationDto.data || null,
        },
      });

      const message = await this.i18n.translate(
        'translation.notification.create.success',
        {
          lang,
        },
      );

      return {
        message,
        notification,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.notification.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async createNotificationForUser(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    data?: Record<string, any>,
    lang: string = 'en',
  ): Promise<CreateNotificationResponseDto> {
    const createNotificationDto: CreateNotificationDto = {
      user_id: userId,
      title,
      message,
      type,
      data,
    };

    return this.createNotification(createNotificationDto, lang);
  }

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 10,
    lang: string = 'en',
  ): Promise<GetNotificationsResponseDto> {
    try {
      const skip = (page - 1) * limit;

      const [notifications, total, unreadCount] = await Promise.all([
        this.prisma.notification.findMany({
          where: {
            user_id: userId,
          },
          select: {
            id: true,
            user_id: true,
            title: true,
            message: true,
            type: true,
            data: true,
            read: true,
            createdAt: true,
            read_at: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.notification.count({
          where: {
            user_id: userId,
          },
        }),
        this.prisma.notification.count({
          where: {
            user_id: userId,
            read: false,
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.notification.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        unreadCount,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.notification.getAll.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateReadStatus(
    notificationId: string,
    userId: string,
    updateReadStatusDto: UpdateReadStatusDto,
    lang: string = 'en',
  ): Promise<UpdateReadStatusResponseDto> {
    try {
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          user_id: userId,
        },
      });

      if (!notification) {
        const message = await this.i18n.translate(
          'translation.notification.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      const updateData: any = {
        read: updateReadStatusDto.read,
      };

      // Set read_at timestamp only when marking as read
      if (updateReadStatusDto.read) {
        updateData.read_at = new Date();
      } else {
        // When marking as unread, clear the read_at timestamp
        updateData.read_at = null;
      }

      const updatedNotification = await this.prisma.notification.update({
        where: {
          id: notificationId,
        },
        data: updateData,
      });

      const message = await this.i18n.translate(
        'translation.notification.updateReadStatus.success',
        {
          lang,
        },
      );

      return {
        message,
        notification: updatedNotification,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.notification.updateReadStatus.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.prisma.notification.count({
        where: {
          user_id: userId,
          read: false,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to get unread notification count',
      );
    }
  }

  async deleteNotification(
    notificationId: string,
    userId: string,
    lang: string = 'en',
  ): Promise<DeleteNotificationResponseDto> {
    try {
      // Check if notification exists and belongs to user
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          user_id: userId,
        },
      });

      if (!existingNotification) {
        const message = await this.i18n.translate(
          'translation.notification.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      await this.prisma.notification.delete({
        where: {
          id: notificationId,
        },
      });

      const message = await this.i18n.translate(
        'translation.notification.delete.success',
        {
          lang,
        },
      );

      return {
        message,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.notification.delete.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async sendPushNotification(
    notificationDto: SendPushNotificationDto,
    lang: string = 'en',
  ): Promise<SendPushNotificationResponseDto> {
    try {
      await this.firebaseAdmin.defaultApp.messaging().send({
        notification: {
          title: notificationDto.title,
          body: notificationDto.body,
        },
        token: notificationDto.deviceId,
        data: notificationDto.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              contentAvailable: true,
              sound: 'default',
            },
          },
        },
      });

      const message = await this.i18n.translate(
        'translation.notification.push.sent',
        { lang },
      );

      return {
        message,
      };
    } catch (error) {
      console.error('Push notification error:', error);
      const message = await this.i18n.translate(
        'translation.notification.push.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }
}
