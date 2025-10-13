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
import {
  MobilemoneyCashoutDto,
  MobilemoneyCashoutResponseDto,
} from '../dto/mobilemoney-cashout.dto';
import {
  MobilemoneyDepositDto,
  MobilemoneyDepositResponseDto,
} from '../dto/mobilemoney-deposit.dto';
import { MoalaBalanceResponseDto } from '../dto/moala-balance.dto';

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

export const ApiMobileMoneyCashout = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Initiate mobile money withdrawal',
      description:
        'Initiate a cashout/withdrawal to a Cameroonian mobile money account (MTN or Orange). Validates phone number format and carrier support. Minimum withdrawal amount is 100 XAF.',
    }),
    ApiBody({
      type: MobilemoneyCashoutDto,
      description: 'Withdrawal details including amount and phone number',
      examples: {
        'MTN Cameroon': {
          summary: 'Withdraw to MTN Cameroon number',
          value: {
            amount: 5000,
            phoneNumber: '677123456',
          },
        },
        'Orange Cameroon': {
          summary: 'Withdraw to Orange Cameroon number',
          value: {
            amount: 10000,
            phoneNumber: '691234567',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description:
        'Withdrawal initiated successfully (message will be translated)',
      type: MobilemoneyCashoutResponseDto,
      example: {
        message: 'Withdrawal initiated successfully',
        transaction: {
          transactionId: 'txn-123456789',
          amount: 5000,
          phoneNumber: '677123456',
          carrier: 'MTN_CM',
          status: 'PENDING',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        'Bad Request - Invalid amount, phone number, or unsupported carrier',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 400 },
          message: {
            oneOf: [
              {
                type: 'string',
                example:
                  'Invalid phone number. Must be a valid Cameroonian mobile number (MTN or Orange)',
              },
              {
                type: 'array',
                items: { type: 'string' },
                example: ['Amount must be at least 100'],
              },
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
      status: 500,
      description:
        'Internal server error - Payment gateway error or configuration issue',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to initiate withdrawal',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiGetMoalaBalance = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get Moala account balance (Admin Only)',
      description:
        'Retrieve the current balance of the Moala mobile money account. This endpoint is restricted to admin users only. Returns balance information including available and pending amounts.',
    }),
    ApiResponse({
      status: 200,
      description:
        'Balance retrieved successfully (message will be translated)',
      type: MoalaBalanceResponseDto,
      example: {
        message: 'Balance retrieved successfully',
        balance: {
          balance: 150000.0,
          currency: 'XAF',
          availableBalance: 150000.0,
          pendingBalance: 0.0,
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
      status: 403,
      description: 'Forbidden - Admin access required',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 403 },
          message: {
            type: 'string',
            example: 'Access denied. Admin privileges required.',
          },
          error: { type: 'string', example: 'Forbidden' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description:
        'Internal server error - Failed to retrieve balance from Moala',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to retrieve balance',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiMobilemoneyDeposit = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Initiate mobile money deposit (cashin)',
      description:
        "Initiate a deposit transaction from a user's mobile money account (MTN or Orange Cameroon) to the platform. The user will receive a prompt on their phone to confirm the transaction. Minimum deposit amount is 100 XAF.",
    }),
    ApiBody({
      type: MobilemoneyDepositDto,
      description: 'Deposit details including amount and phone number',
      examples: {
        mtnDeposit: {
          summary: 'MTN Cameroon deposit',
          description: 'Deposit from MTN mobile money account',
          value: {
            amount: 5000,
            phoneNumber: '670123456',
          },
        },
        orangeDeposit: {
          summary: 'Orange Cameroon deposit',
          description: 'Deposit from Orange Money account',
          value: {
            amount: 10000,
            phoneNumber: '690264140',
          },
        },
        minimumDeposit: {
          summary: 'Minimum deposit amount',
          description: 'Deposit with minimum allowed amount',
          value: {
            amount: 100,
            phoneNumber: '670123456',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description:
        'Deposit initiated successfully. User will receive a prompt to confirm the transaction on their phone. (message will be translated)',
      type: MobilemoneyDepositResponseDto,
      example: {
        message: 'Deposit initiated successfully',
        transaction: {
          transactionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          amount: 5000,
          phoneNumber: '670123456',
          carrier: 'MTN_CM',
          status: 'PENDING',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        'Bad request - Invalid phone number, unsupported carrier, or amount below minimum',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 400 },
          message: {
            type: 'string',
            examples: [
              'Invalid phone number. Must be a valid Cameroonian mobile number (MTN or Orange)',
              'Amount must be at least 100',
              'Carrier not supported for deposit',
            ],
          },
          error: { type: 'string', example: 'Bad Request' },
        },
        examples: {
          invalidPhoneNumber: {
            statusCode: 400,
            message:
              'Invalid phone number. Must be a valid Cameroonian mobile number (MTN or Orange)',
            error: 'Bad Request',
          },
          minimumAmount: {
            statusCode: 400,
            message: 'Amount must be at least 100',
            error: 'Bad Request',
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
      description:
        'Internal server error - Payment gateway error or configuration issue',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to initiate deposit',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );
