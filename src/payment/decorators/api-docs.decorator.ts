import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { InitializeWalletRequestDto } from '../dto/initialize-wallet-request.dto';
import { InitializeWalletResponseDto } from '../dto/initialize-wallet.dto';
import {
  GetWalletRequestDto,
  GetWalletResponseDto,
} from '../dto/get-wallet-request.dto';

export const ApiInitializeWallet = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Initialize user wallet',
      description:
        'Initialize a new wallet for the authenticated user. Each user can only have one wallet. Creates wallet with zero balance and BLOCKED state by default. Currency must be specified (e.g., XAF, USD, EUR).',
    }),
    ApiBody({
      type: InitializeWalletRequestDto,
      description: 'Wallet initialization data with currency',
      examples: {
        'XAF Currency': {
          summary: 'Initialize with XAF currency',
          value: {
            currency: 'XAF',
          },
        },
        'USD Currency': {
          summary: 'Initialize with USD currency',
          value: {
            currency: 'USD',
          },
        },
        'EUR Currency': {
          summary: 'Initialize with EUR currency',
          value: {
            currency: 'EUR',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description:
        'Wallet initialized successfully (message will be translated)',
      type: InitializeWalletResponseDto,
      example: {
        message: 'Wallet initialized successfully',
        wallet: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          userId: '123e4567-e89b-12d3-a456-426614174001',
          available_balance: 0.0,
          hold_balance: 0.0,
          total_balance: 0.0,
          state: 'BLOCKED',
          currency: 'XAF',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Currency not provided or invalid',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 400 },
          message: {
            type: 'array',
            items: { type: 'string' },
            example: [
              'currency should not be empty',
              'currency must be a string',
            ],
          },
          error: { type: 'string', example: 'Bad Request' },
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
      description: 'User not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: { type: 'string', example: 'User not found' },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - User already has a wallet',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 409 },
          message: { type: 'string', example: 'User already has a wallet' },
          error: { type: 'string', example: 'Conflict' },
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
          message: { type: 'string', example: 'Failed to initialize wallet' },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiGetWallet = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get wallet by wallet ID or user ID',
      description:
        'Retrieve complete wallet information including user details. Provide either walletId or userId (not both). Returns wallet balance, state, currency, and associated user information.',
    }),
    ApiBody({
      type: GetWalletRequestDto,
      description:
        'Wallet retrieval parameters (provide either walletId or userId)',
      examples: {
        'By Wallet ID': {
          summary: 'Get wallet using wallet ID',
          value: {
            walletId: '123e4567-e89b-12d3-a456-426614174000',
          },
        },
        'By User ID': {
          summary: 'Get wallet using user ID',
          value: {
            userId: '123e4567-e89b-12d3-a456-426614174001',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Wallet retrieved successfully (message will be translated)',
      type: GetWalletResponseDto,
      example: {
        message: 'Wallet retrieved successfully',
        wallet: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          userId: '123e4567-e89b-12d3-a456-426614174001',
          available_balance: 1500.5,
          hold_balance: 250.0,
          total_balance: 1750.5,
          state: 'ACTIVE',
          currency: 'XAF',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-16T14:30:00.000Z',
          user: {
            id: '123e4567-e89b-12d3-a456-426614174001',
            email: 'user@example.com',
            name: 'John Doe',
            picture: 'https://example.com/profile.jpg',
            role: 'USER',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 400 },
          message: {
            type: 'string',
            example: 'Either walletId or userId must be provided',
          },
          error: { type: 'string', example: 'Bad Request' },
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
      description: 'Wallet not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: { type: 'string', example: 'Wallet not found' },
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
          message: { type: 'string', example: 'Failed to retrieve wallet' },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );
