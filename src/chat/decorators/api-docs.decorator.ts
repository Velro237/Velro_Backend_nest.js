import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateChatDto, CreateChatResponseDto } from '../dto/create-chat.dto';
import { GetChatsQueryDto, GetChatsResponseDto } from '../dto/get-chats.dto';
import {
  GetMessagesQueryDto,
  GetMessagesResponseDto,
} from '../dto/get-messages.dto';

export function ApiCreateChat() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new chat',
      description: 'Create a new chat with specified members',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiBody({ type: CreateChatDto }),
    ApiResponse({
      status: 201,
      description: 'Chat created successfully',
      type: CreateChatResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input data',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'array',
            items: { type: 'string' },
            example: [
              'memberIds must be an array',
              'Each memberId must be a valid UUID',
            ],
          },
          error: { type: 'string', example: 'Bad Request' },
          statusCode: { type: 'number', example: 400 },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'One or more users not found' },
          error: { type: 'string', example: 'Not Found' },
          statusCode: { type: 'number', example: 404 },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Failed to create chat' },
          error: { type: 'string', example: 'Internal Server Error' },
          statusCode: { type: 'number', example: 500 },
        },
      },
    }),
  );
}

export function ApiGetChats() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get user chats',
      description:
        'Retrieve all chats for the authenticated user with pagination and search',
    }),
    ApiBearerAuth('JWT-auth'),
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
      description: 'Number of chats per page',
      example: 10,
    }),
    ApiQuery({
      name: 'search',
      required: false,
      type: String,
      description: 'Search term for chat names',
      example: 'project',
    }),
    ApiResponse({
      status: 200,
      description: 'Chats retrieved successfully',
      type: GetChatsResponseDto,
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Failed to retrieve chats' },
          error: { type: 'string', example: 'Internal Server Error' },
          statusCode: { type: 'number', example: 500 },
        },
      },
    }),
  );
}

export function ApiGetMessages() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get chat messages',
      description: 'Retrieve messages from a specific chat with pagination',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiQuery({
      name: 'chatId',
      required: true,
      type: String,
      description: 'Chat ID to get messages from',
      example: '123e4567-e89b-12d3-a456-426614174000',
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
      description: 'Number of messages per page',
      example: 20,
    }),
    ApiResponse({
      status: 200,
      description: 'Messages retrieved successfully',
      type: GetMessagesResponseDto,
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Not a member of this chat',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Not a member of this chat' },
          error: { type: 'string', example: 'Forbidden' },
          statusCode: { type: 'number', example: 403 },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Failed to retrieve messages' },
          error: { type: 'string', example: 'Internal Server Error' },
          statusCode: { type: 'number', example: 500 },
        },
      },
    }),
  );
}
