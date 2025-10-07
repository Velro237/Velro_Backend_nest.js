import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import {
  GetNotificationsQueryDto,
  GetNotificationsResponseDto,
} from '../dto/get-notifications.dto';
import { DeleteNotificationResponseDto } from '../dto/delete-notification.dto';
import {
  UpdateReadStatusDto,
  UpdateReadStatusResponseDto,
} from '../dto/update-read-status.dto';
import {
  SendPushNotificationDto,
  SendPushNotificationResponseDto,
} from '../dto/send-push-notification.dto';

export const ApiGetNotifications = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get user notifications',
      description:
        'Retrieve all notifications for the authenticated user with pagination and unread count.',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number for pagination',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of notifications per page (max 100)',
      example: 10,
    }),
    ApiResponse({
      status: 200,
      description:
        'Notifications retrieved successfully (message will be translated)',
      type: GetNotificationsResponseDto,
      examples: {
        success: {
          summary: 'Notifications retrieved successfully',
          value: {
            message: 'Notifications retrieved successfully',
            notifications: [
              {
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
              {
                id: '123e4567-e89b-12d3-a456-426614174003',
                user_id: '123e4567-e89b-12d3-a456-426614174001',
                title: 'Trip Alert',
                message: 'A new trip matching your criteria has been found',
                type: 'ALERT',
                data: { alertId: '123e4567-e89b-12d3-a456-426614174004' },
                read: true,
                createdAt: '2024-01-09T15:30:00.000Z',
                read_at: '2024-01-09T16:00:00.000Z',
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 25,
              totalPages: 3,
            },
            unreadCount: 5,
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 401 },
          message: { type: 'string', example: 'Unauthorized' },
          error: { type: 'string', example: 'Unauthorized' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to retrieve notifications',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiUpdateReadStatus = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update notification read status',
      description:
        'Update the read status of a specific notification. Set read to true to mark as read, false to mark as unread. Only the notification owner can update its status.',
    }),
    ApiParam({
      name: 'id',
      description: 'Notification ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description:
        'Notification read status updated successfully (message will be translated)',
      type: UpdateReadStatusResponseDto,
      examples: {
        markAsRead: {
          summary: 'Notification marked as read',
          value: {
            message: 'Notification read status updated successfully',
            notification: {
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
          },
        },
        markAsUnread: {
          summary: 'Notification marked as unread',
          value: {
            message: 'Notification read status updated successfully',
            notification: {
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
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 401 },
          message: { type: 'string', example: 'Unauthorized' },
          error: { type: 'string', example: 'Unauthorized' },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Notification not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: { type: 'string', example: 'Notification not found' },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to update notification read status',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiDeleteNotification = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Delete notification',
      description:
        'Delete a specific notification. Only the notification owner can delete it.',
    }),
    ApiParam({
      name: 'id',
      description: 'Notification ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description:
        'Notification deleted successfully (message will be translated)',
      type: DeleteNotificationResponseDto,
      examples: {
        success: {
          summary: 'Notification deleted successfully',
          value: {
            message: 'Notification deleted successfully',
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 401 },
          message: { type: 'string', example: 'Unauthorized' },
          error: { type: 'string', example: 'Unauthorized' },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Notification not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: { type: 'string', example: 'Notification not found' },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to delete notification',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );
