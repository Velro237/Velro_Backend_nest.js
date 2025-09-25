import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserResponseDto } from '../dto/user-response.dto.ts';
import { UpdateUserDto } from '../dto/update-user.dto';

// Helpers d’erreurs
const ConflictSchema = (message = 'User with this email already exists') => ({
  type: 'object',
  properties: {
    message: { type: 'string', example: message },
    error: { type: 'string', example: 'Conflict' },
    statusCode: { type: 'number', example: 409 },
  },
});

const BadRequestArraySchema = (examples: string[]) => ({
  type: 'object',
  properties: {
    message: { type: 'array', items: { type: 'string' }, example: examples },
    error: { type: 'string', example: 'Bad Request' },
    statusCode: { type: 'number', example: 400 },
  },
});

const NotFoundSchema = (msg = 'User not found') => ({
  type: 'object',
  properties: {
    message: { type: 'string', example: msg },
    error: { type: 'string', example: 'Not Found' },
    statusCode: { type: 'number', example: 404 },
  },
});

const InternalErrorSchema = (msg = 'Internal Server Error') => ({
  type: 'object',
  properties: {
    message: { type: 'string', example: msg },
    error: { type: 'string', example: 'Internal Server Error' },
    statusCode: { type: 'number', example: 500 },
  },
});

export function ApiUserWelcome() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get current user information',
      description:
        'Returns the current authenticated user information with a personalized welcome message',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description: 'Current user information with personalized message',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Hello, John Doe!' },
          user: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: '123e4567-e89b-12d3-a456-426614174000',
              },
              email: { type: 'string', example: 'john@example.com' },
              role: { type: 'string', example: 'USER' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
    }),
  );
}

// CREATE
export function ApiCreateUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create user',
      description: 'Create a new user account (password hashed if provided)',
    }),
    ApiBody({ type: CreateUserDto }),
    ApiResponse({
      status: 201,
      description: 'User created',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: 'Email already exists',
      schema: ConflictSchema(),
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input data',
      schema: BadRequestArraySchema([
        'email must be an email',
        'password must be longer than or equal to 8 characters',
      ]),
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema('Failed to create user'),
    }),
  );
}
// FIND ALL
export function ApiFindAllUsers() {
  return applyDecorators(
    ApiOperation({
      summary: 'List users',
      description: 'Return all users (paginating in real life)',
    }),
    ApiResponse({
      status: 200,
      description: 'OK',
      type: UserResponseDto,
      isArray: true,
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema(),
    }),
  );
}

// FIND ONE
export function ApiFindOneUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get one user',
      description: 'Return a single user by UUID',
    }),
    ApiResponse({ status: 200, description: 'OK', type: UserResponseDto }),
    ApiResponse({
      status: 404,
      description: 'Not Found',
      schema: NotFoundSchema('User not found'),
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema(),
    }),
  );
}

// UPDATE
export function ApiUpdateUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update user',
      description:
        'Patch fields of an existing user (hash password if provided)',
    }),
    ApiBody({ type: UpdateUserDto }),
    ApiResponse({ status: 200, description: 'Updated', type: UserResponseDto }),
    ApiResponse({
      status: 409,
      description: 'Email already exists',
      schema: ConflictSchema(),
    }),
    ApiResponse({
      status: 404,
      description: 'Not Found',
      schema: NotFoundSchema('User not found'),
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input data',
      schema: BadRequestArraySchema(['email must be an email']),
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema(),
    }),
  );
}
// REMOVE
export function ApiRemoveUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete user',
      description:
        'Delete a user by UUID and returns the deleted record (without password)',
    }),
    ApiResponse({ status: 200, description: 'Deleted', type: UserResponseDto }),
    ApiResponse({
      status: 404,
      description: 'Not Found',
      schema: NotFoundSchema('User not found'),
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema(),
    }),
  );
}
