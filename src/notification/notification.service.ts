import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
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
import { SendEmailDto, SendEmailResponseDto } from './dto/send-email.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Mailgun from 'mailgun.js';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationService {
  private expo = new Expo();
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
    @Inject('FIREBASE_ADMIN') private readonly firebaseAdmin: any,
  ) {}

  /**
   * Normalize and validate user language for i18n
   * Ensures language is lowercase and valid ('en' or 'fr')
   */
  private normalizeLanguage(lang: string | null | undefined): string {
    if (!lang) return 'en';
    const normalized = lang.toLowerCase().trim();
    // Only allow 'en' or 'fr', default to 'en' if invalid
    return normalized === 'fr' ? 'fr' : 'en';
  }

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
          trip_id: createNotificationDto.trip_id || null,
          request_id: createNotificationDto.request_id || null,
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
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                picture: true,
              },
            },
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

      // Collect all unique trip IDs from notifications that have trip data
      const tripIds = new Set<string>();
      notifications.forEach((notification) => {
        if (notification.data) {
          const data = notification.data as any;
          if (data.trip?.id) {
            tripIds.add(data.trip.id);
          }
          if (data.trip_id) {
            tripIds.add(data.trip_id);
          }
        }
      });

      // Fetch all trip items with prices for all trips in one batch query
      const tripItemsWithPricesMap = new Map<string, Map<string, any[]>>();
      if (tripIds.size > 0) {
        const allTripItems = await this.prisma.tripItemsList.findMany({
          where: {
            trip_id: {
              in: Array.from(tripIds),
            },
          },
          include: {
            prices: {
              select: {
                currency: true,
                price: true,
              },
            },
          },
        });

        // Group by trip_id and create a map of trip_item_id to prices
        allTripItems.forEach((item) => {
          if (!tripItemsWithPricesMap.has(item.trip_id)) {
            tripItemsWithPricesMap.set(item.trip_id, new Map());
          }
          const tripMap = tripItemsWithPricesMap.get(item.trip_id)!;
          tripMap.set(
            item.trip_item_id,
            item.prices.map((p) => ({
              currency: p.currency,
              price: Number(p.price),
            })),
          );
        });
      }

      // Process notifications to add prices array to trip items
      const processedNotifications = notifications.map((notification) => {
        if (!notification.data) {
          return notification;
        }

        const data = notification.data as any;
        let updatedData = { ...data };

        // Process trip_items in trip object
        if (data.trip?.trip_items && Array.isArray(data.trip.trip_items)) {
          const tripId = data.trip.id;
          if (tripId) {
            const pricesMap = tripItemsWithPricesMap.get(tripId);
            if (pricesMap) {
              // Add prices array to each trip item
              updatedData.trip.trip_items = data.trip.trip_items.map(
                (item: any) => ({
                  ...item,
                  prices: pricesMap.get(item.trip_item_id) || [],
                }),
              );
            }
          }
        }

        // Process request_items (they may also have trip_item references)
        if (data.request_items && Array.isArray(data.request_items)) {
          const tripId = data.trip_id || data.trip?.id;
          if (tripId) {
            const pricesMap = tripItemsWithPricesMap.get(tripId);
            if (pricesMap) {
              // Add prices array to each request item
              updatedData.request_items = data.request_items.map(
                (item: any) => {
                  const prices = pricesMap.get(item.trip_item_id) || [];
                  return {
                    ...item,
                    prices,
                  };
                },
              );
            }
          }
        }

        return {
          ...notification,
          data: updatedData,
        };
      });

      const message = await this.i18n.translate(
        'translation.notification.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        notifications: processedNotifications,
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

  async sendPushNotificationFirebase(
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

  async sendEmail(
    emailDto: SendEmailDto,
    lang: string = 'en',
  ): Promise<SendEmailResponseDto> {
    try {
      // Get Mailgun credentials from environment variables
      const mailgunApiKey = this.configService.get<string>('MAILGUN_API_KEY');
      const mailgunDomain = this.configService.get<string>('MAILGUN_DOMAIN');
      const mailgunFromEmail = this.configService.get<string>(
        'MAILGUN_FROM_EMAIL',
        'Velro <noreply@velro.app>',
      );
      const mailgunURL = this.configService.get<string>('MAILGUN_URL');

      if (!mailgunApiKey || !mailgunDomain) {
        throw new BadRequestException(
          'Mailgun credentials are not configured. Please set MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables.',
        );
      }

      // Validate that either text or html is provided
      if (!emailDto.text && !emailDto.html) {
        throw new BadRequestException(
          'Either text or html content must be provided',
        );
      }
      const mailgun = new Mailgun(FormData);
      const mg = mailgun.client({
        username: 'api',
        key: mailgunApiKey,
        // When you have an EU-domain, you must specify the endpoint:
        url: mailgunURL,
      });

      await mg.messages.create(mailgunDomain, {
        from: mailgunFromEmail,
        to: emailDto.to,
        subject: emailDto.subject,
        text: emailDto.text,
        html: emailDto.html,
      });

      const message = await this.i18n.translate(
        'translation.notification.email.sent',
        {
          lang,
          defaultValue: 'Email sent successfully',
        },
      );

      return {
        message,
      };
    } catch (error) {
      console.error('Email sending error:', error.response?.data || error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      const message = await this.i18n.translate(
        'translation.notification.email.failed',
        {
          lang,
          defaultValue: 'Failed to send email',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async sendPushNotification(
    notificationDto: SendPushNotificationDto,
    lang: string = 'en',
  ): Promise<SendPushNotificationResponseDto> {
    // Normalize language to ensure it matches user's language preference
    const normalizedLang = this.normalizeLanguage(lang);

    if (!Expo.isExpoPushToken(notificationDto.deviceId)) {
      this.logger.error(`Invalid Expo push token: ${notificationDto.deviceId}`);
      const message = await this.i18n.translate(
        'translation.notification.push.failed',
        { lang: normalizedLang },
      );
      throw new BadRequestException(message);
    }

    const messages: ExpoPushMessage[] = [
      {
        to: notificationDto.deviceId,
        sound: 'default',
        title: notificationDto.title,
        body: notificationDto.body,
        data: notificationDto.data || {},
      },
    ];

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        this.logger.log('Push sent:', ticketChunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        this.logger.error('Push send error:', error);
        const message = await this.i18n.translate(
          'translation.notification.push.failed',
          { lang: normalizedLang },
        );
        throw new InternalServerErrorException(message);
      }
    }

    const message = await this.i18n.translate(
      'translation.notification.push.sent',
      { lang: normalizedLang },
    );

    return {
      message,
    };
  }

  /**
   * Send push notification to a user by their userId
   * This is a non-throwing helper method for internal use
   * If sending fails, it logs the error but doesn't throw
   */
  async sendPushNotificationToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    lang: string = 'en',
  ): Promise<void> {
    try {
      // Get user's device_id
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { device_id: true },
      });

      if (!user || !user.device_id) {
        this.logger.log(
          `User ${userId} has no device_id, skipping push notification`,
        );
        return;
      }

      // Validate that it's a valid Expo push token
      if (!Expo.isExpoPushToken(user.device_id)) {
        this.logger.warn(
          `User ${userId} has invalid Expo push token: ${user.device_id}`,
        );
        return;
      }

      // Send the push notification
      const messages: ExpoPushMessage[] = [
        {
          to: user.device_id,
          sound: 'default',
          title,
          body,
          data: data || {},
        },
      ];

      const chunks = this.expo.chunkPushNotifications(messages);

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          this.logger.log(
            `Push notification sent to user ${userId}:`,
            ticketChunk,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send push notification to user ${userId}:`,
            error,
          );
        }
      }
    } catch (error) {
      // Log the error but don't throw - we don't want push notification failures to break the main flow
      this.logger.error(
        `Error in sendPushNotificationToUser for user ${userId}:`,
        error,
      );
    }
  }
}
